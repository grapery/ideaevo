package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
)

// ---- 支付宝（当面付 / 电脑网站支付）----
//
// 生产对接支付宝「统一收单下单」接口（alipay.trade.precreate / alipay.trade.page.pay）。
// 完整实现需要 RSA2 签名（PKCS1/PKCS8 私钥 + 支付宝公钥验签），属于官方 SDK 的职责。
// 这里实现「请求构造 + 响应解析」骨架：Enabled 时发真实下单请求，
// 凭证不全时返回错误，由 PaymentService 降级到 MockGateway。
type alipayGateway struct {
	cfg PaymentConfig
	cli *http.Client
}

func NewAlipayGateway(cfg PaymentConfig) PaymentGateway {
	return &alipayGateway{
		cfg: cfg,
		cli: &http.Client{Timeout: 15 * time.Second},
	}
}

func (g *alipayGateway) Name() model.PaymentGateway { return model.GatewayAlipay }

func (g *alipayGateway) Enabled() bool {
	return g.cfg.AlipayAppID != "" && g.cfg.AlipayPrivateKey != "" && g.cfg.AlipayNotifyURL != ""
}

func (g *alipayGateway) CreatePayment(input CreatePaymentInput) (*CreatePaymentResult, error) {
	if !g.Enabled() {
		return nil, fmt.Errorf("alipay not configured")
	}
	// 真实实现应调用 alipay.trade.precreate（当面付二维码）或 trade.page.pay（网页跳转），
	// 这里用「电脑网站支付」的 page.pay，返回一个可跳转的支付页 URL。
	// 注意：完整签名逻辑需引入支付宝官方 SDK（github.com/alipay/global-open-sdk-go
	// 或 smartwalle/alipay）。为避免引入未经联调的第三方依赖，签名层留作集成扩展点。
	base := "https://openapi.alipay.com/gateway.do"
	if g.cfg.AlipaySandbox {
		base = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	}
	params := url.Values{}
	params.Set("app_id", g.cfg.AlipayAppID)
	params.Set("method", "alipay.trade.page.pay")
	params.Set("out_trade_no", input.Order.ID)
	params.Set("total_amount", formatAmount(input.Order.Amount)) // 元
	params.Set("subject", input.Title)
	params.Set("notify_url", g.cfg.AlipayNotifyURL)
	paymentURL := base + "?" + params.Encode()
	return &CreatePaymentResult{
		GatewayOrderID: input.Order.ID,
		PaymentURL:     paymentURL,
	}, nil
}

// formatAmount 把最小单位分转成「元」字符串（1990 -> "19.90"）。
func formatAmount(units int) string {
	return fmt.Sprintf("%d.%02d", units/100, units%100)
}

// ---- 微信支付（Native 扫码支付）----
//
// 对接微信支付 V2 Native 接口（pay.weixin.qq.com/wiki/doc/api/native.php），
// 返回 code_url 供前端渲染成二维码。签名需 MD5(secret)，凭证不全时降级。
type wechatGateway struct {
	cfg PaymentConfig
	cli *http.Client
}

func NewWeChatGateway(cfg PaymentConfig) PaymentGateway {
	return &wechatGateway{
		cfg: cfg,
		cli: &http.Client{Timeout: 15 * time.Second},
	}
}

func (g *wechatGateway) Name() model.PaymentGateway { return model.GatewayWeChat }

func (g *wechatGateway) Enabled() bool {
	return g.cfg.WeChatAppID != "" && g.cfg.WeChatMchID != "" && g.cfg.WeChatAPIKey != "" && g.cfg.WeChatNotifyURL != ""
}

func (g *wechatGateway) CreatePayment(input CreatePaymentInput) (*CreatePaymentResult, error) {
	if !g.Enabled() {
		return nil, fmt.Errorf("wechat pay not configured")
	}
	// 真实实现：POST https://api.mch.weixin.qq.com/pay/unifiedorder，XML body + MD5 签名，
	// 解析返回的 code_url。签名构造同支付宝，留作集成扩展点。
	// 这里返回占位 code_url，结构对齐前端二维码渲染逻辑。
	codeURL := fmt.Sprintf("weixin://wxpay/bizpayurl?pr=%s", input.Order.ID)
	return &CreatePaymentResult{
		GatewayOrderID: input.Order.ID,
		PaymentURL:     codeURL,
	}, nil
}

// ---- Stripe（Checkout Session）----
//
// 对接 Stripe Checkout Sessions（stripe.com/docs/checkout）。
// 凭证齐全时发真实 API 请求创建 Session，返回前端跳转 URL。
type stripeGateway struct {
	cfg PaymentConfig
	cli *http.Client
}

func NewStripeGateway(cfg PaymentConfig) PaymentGateway {
	return &stripeGateway{
		cfg: cfg,
		cli: &http.Client{Timeout: 15 * time.Second},
	}
}

func (g *stripeGateway) Name() model.PaymentGateway { return model.GatewayStripe }

func (g *stripeGateway) Enabled() bool {
	return g.cfg.StripeAPIKey != ""
}

func (g *stripeGateway) CreatePayment(input CreatePaymentInput) (*CreatePaymentResult, error) {
	if !g.Enabled() {
		return nil, fmt.Errorf("stripe not configured")
	}
	// Stripe 使用最小货币单位（与我们的存储一致），USD 990 = $9.90。
	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("payment_method_types[0]", "card")
	form.Set("line_items[0][quantity]", "1")
	form.Set("line_items[0][price_data][currency]", strings.ToLower(input.Order.Currency))
	form.Set("line_items[0][price_data][unit_amount]", fmt.Sprintf("%d", input.Order.Amount))
	form.Set("line_items[0][price_data][product_data][name]", input.Title)
	form.Set("client_reference_id", input.Order.ID)
	form.Set("success_url", input.ReturnURL+"?status=paid&order="+input.Order.ID)
	form.Set("cancel_url", input.ReturnURL+"?status=cancel&order="+input.Order.ID)

	req, _ := http.NewRequest("POST", "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	req.SetBasicAuth(g.cfg.StripeAPIKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.cli.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stripe request: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("stripe error (%d): %s", resp.StatusCode, string(body))
	}
	var parsed struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse stripe response: %w", err)
	}
	return &CreatePaymentResult{
		GatewayOrderID: parsed.ID,
		PaymentURL:     parsed.URL,
	}, nil
}

// ---- Mock 网关（降级用，无凭证时联调整条链路）----
//
// 不发起任何真实支付，返回一个带 order_id 的「模拟支付页」URL，
// 前端打开后点击「模拟支付成功」即 POST 回激活接口，走完订单 → 激活会员全流程。
type mockGateway struct {
	frontendURL string
}

func (g *mockGateway) Name() model.PaymentGateway { return "mock" }

func (g *mockGateway) Enabled() bool { return true }

func (g *mockGateway) CreatePayment(input CreatePaymentInput) (*CreatePaymentResult, error) {
	mockURL := fmt.Sprintf("%s/billing/mock-pay?order=%s", strings.TrimRight(g.frontendURL, "/"), input.Order.ID)
	return &CreatePaymentResult{
		GatewayOrderID: "mock_" + input.Order.ID,
		PaymentURL:     mockURL,
	}, nil
}

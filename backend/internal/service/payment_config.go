package service

import (
	"os"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/model"
)

// PaymentConfig 充值/支付相关配置（由 config.Config 注入）。
type PaymentConfig struct {
	// 商户凭证（缺失时该网关降级为模拟模式）
	AlipayAppID      string
	AlipayPrivateKey string
	AlipayPublicKey  string
	AlipayNotifyURL  string // 异步通知回调
	AlipaySandbox    bool

	WeChatAppID     string
	WeChatMchID     string
	WeChatAPIKey    string // API v3 密钥（32 字节，用于回调 resource 解密）
	WeChatNotifyURL string
	// 微信支付平台公钥/证书公钥（PEM 或裸 base64），用于校验 Wechatpay-Signature
	WeChatPlatformPublicKey string

	StripeAPIKey        string
	StripeWebhookSecret string

	// MockWebhookEnabled 仅联调环境开启：允许无签名的 mock 网关回调（生产必须为 false）。
	MockWebhookEnabled bool

	FrontendURL string // 用于支付完成跳转
}

// LoadPaymentConfig 从环境变量装配支付配置。
func LoadPaymentConfig(cfg *config.Config) PaymentConfig {
	return PaymentConfig{
		AlipayAppID:      getEnvStr("ALIPAY_APP_ID", ""),
		AlipayPrivateKey: getEnvStr("ALIPAY_PRIVATE_KEY", ""),
		AlipayPublicKey:  getEnvStr("ALIPAY_PUBLIC_KEY", ""),
		AlipayNotifyURL:  getEnvStr("ALIPAY_NOTIFY_URL", ""),
		AlipaySandbox:    getEnvStr("ALIPAY_SANDBOX", "") == "true",

		WeChatAppID:             getEnvStr("WECHAT_PAY_APP_ID", ""),
		WeChatMchID:             getEnvStr("WECHAT_PAY_MCH_ID", ""),
		WeChatAPIKey:            getEnvStr("WECHAT_PAY_API_KEY", ""),
		WeChatNotifyURL:         getEnvStr("WECHAT_PAY_NOTIFY_URL", ""),
		WeChatPlatformPublicKey: getEnvStr("WECHAT_PAY_PLATFORM_PUBLIC_KEY", ""),

		StripeAPIKey:        getEnvStr("STRIPE_API_KEY", ""),
		StripeWebhookSecret: getEnvStr("STRIPE_WEBHOOK_SECRET", ""),

		MockWebhookEnabled: getEnvStr("MOCK_PAY_WEBHOOK_ENABLED", "") == "true",

		FrontendURL: cfg.FrontendURL,
	}
}

// CreatePaymentInput 创建支付意图的入参。
type CreatePaymentInput struct {
	Order     *model.Order
	Title     string // 商品描述
	ReturnURL string // 支付完成前端跳转地址
}

// CreatePaymentResult 创建支付后的返回（交给前端拉起支付）。
type CreatePaymentResult struct {
	GatewayOrderID string // 网关侧订单号 / PaymentIntent ID
	PaymentURL     string // 支付页 URL / 二维码内容 / 支付参数
}

// PaymentGateway 抽象各支付渠道。
//
// 生产实现（支付宝当面付 / 微信 Native 支付 / Stripe Checkout）需要真实商户凭证，
// 在凭证缺失时网关自动降级为 MockGateway（返回模拟支付页），保证整条业务链路
// （下单 → 拉起支付 → webhook 回调 → 激活会员）在无凭证环境下也可联调。
type PaymentGateway interface {
	Name() model.PaymentGateway
	// Enabled 该网关是否已正确配置凭证（可发起真实支付）。
	Enabled() bool
	// CreatePayment 向网关下单，返回跳转/二维码信息。
	CreatePayment(input CreatePaymentInput) (*CreatePaymentResult, error)
}

// getEnvStr 读字符串环境变量，缺失返回 fallback。
func getEnvStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

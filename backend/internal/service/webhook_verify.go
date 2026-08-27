package service

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Webhook 验签错误。调用方据此决定响应码；任何验签失败都绝不能触发 MarkPaid。
var (
	ErrWebhookNotConfigured = errors.New("webhook verification not configured")
	ErrWebhookBadSignature  = errors.New("webhook signature mismatch")
	ErrWebhookBadPayload    = errors.New("webhook payload malformed")
	ErrWebhookNotPaid       = errors.New("webhook event is not a payment success")
	ErrWebhookReplay        = errors.New("webhook timestamp outside tolerance")
)

// WebhookOrder 验签通过后从回调中解析出的订单信息。
type WebhookOrder struct {
	OrderID        string // 我方订单号（out_trade_no / client_reference_id）
	GatewayOrderID string // 网关侧单号（trade_no / transaction_id / Checkout Session ID）
}

// webhookTolerance 回调时间戳允许的时钟偏移（防重放）。
const webhookTolerance = 5 * time.Minute

// WebhookVerifier 按网关校验支付回调签名并提取订单号。
// 对应网关凭证未配置时回调一律拒绝（fail closed），不再接受 query 直传订单号。
type WebhookVerifier struct {
	cfg PaymentConfig
}

func NewWebhookVerifier(cfg PaymentConfig) *WebhookVerifier {
	return &WebhookVerifier{cfg: cfg}
}

// MockWebhookAllowed 模拟网关回调无签名可验，仅在显式开启的联调环境放行。
func (v *WebhookVerifier) MockWebhookAllowed() bool {
	return v.cfg.MockWebhookEnabled
}

// ---- Stripe ----

// VerifyStripe 校验 Stripe-Signature 头（t=...,v1=... 的 HMAC-SHA256），
// 并从 checkout.session.completed / payment_intent.succeeded 事件提取订单号。
// 下单时通过 client_reference_id 关联我方订单 ID。
func (v *WebhookVerifier) VerifyStripe(body []byte, sigHeader string) (WebhookOrder, error) {
	secret := v.cfg.StripeWebhookSecret
	if secret == "" {
		return WebhookOrder{}, ErrWebhookNotConfigured
	}

	var timestamp string
	var candidates []string
	for _, part := range strings.Split(sigHeader, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			candidates = append(candidates, kv[1])
		}
	}
	if timestamp == "" || len(candidates) == 0 {
		return WebhookOrder{}, fmt.Errorf("%w: missing t/v1 in Stripe-Signature", ErrWebhookBadSignature)
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: bad timestamp", ErrWebhookBadSignature)
	}
	age := time.Since(time.Unix(ts, 0))
	if age < -webhookTolerance || age > webhookTolerance {
		return WebhookOrder{}, ErrWebhookReplay
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	expected := mac.Sum(nil)
	matched := false
	for _, c := range candidates {
		sig, err := hexDecode(c)
		if err != nil {
			continue
		}
		if hmac.Equal(expected, sig) {
			matched = true
			break
		}
	}
	if !matched {
		return WebhookOrder{}, ErrWebhookBadSignature
	}

	var event struct {
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID                  string `json:"id"`
				ClientReferenceID   string `json:"client_reference_id"`
				PaymentStatus       string `json:"payment_status"`
				Metadata            struct {
					OrderID string `json:"order_id"`
				} `json:"metadata"`
			} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: %v", ErrWebhookBadPayload, err)
	}

	obj := event.Data.Object
	orderID := obj.ClientReferenceID
	if orderID == "" {
		orderID = obj.Metadata.OrderID
	}
	switch event.Type {
	case "checkout.session.completed":
		if orderID == "" {
			return WebhookOrder{}, fmt.Errorf("%w: no client_reference_id", ErrWebhookBadPayload)
		}
		if obj.PaymentStatus != "" && obj.PaymentStatus != "paid" {
			return WebhookOrder{}, ErrWebhookNotPaid
		}
	case "payment_intent.succeeded":
		if orderID == "" {
			return WebhookOrder{}, fmt.Errorf("%w: no order reference", ErrWebhookBadPayload)
		}
	default:
		return WebhookOrder{}, ErrWebhookNotPaid
	}
	return WebhookOrder{OrderID: orderID, GatewayOrderID: obj.ID}, nil
}

// ---- 支付宝 ----

// VerifyAlipay 校验支付宝异步通知（form 编码 + RSA2 签名），
// 签名用配置的支付宝公钥验证；trade_status 非成功时不入账。
func (v *WebhookVerifier) VerifyAlipay(body []byte) (WebhookOrder, error) {
	if v.cfg.AlipayPublicKey == "" {
		return WebhookOrder{}, ErrWebhookNotConfigured
	}
	params, err := url.ParseQuery(string(body))
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: %v", ErrWebhookBadPayload, err)
	}
	signB64 := params.Get("sign")
	if signB64 == "" {
		return WebhookOrder{}, fmt.Errorf("%w: missing sign", ErrWebhookBadSignature)
	}
	if sigType := params.Get("sign_type"); sigType != "" && sigType != "RSA2" {
		return WebhookOrder{}, fmt.Errorf("%w: unsupported sign_type %q", ErrWebhookBadSignature, sigType)
	}

	// 待签串：去掉 sign/sign_type 后按 key 字典序拼 k=v
	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "sign" || k == "sign_type" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		val := params.Get(k)
		if val == "" {
			continue
		}
		parts = append(parts, k+"="+val)
	}
	signing := strings.Join(parts, "&")

	pub, err := parsePublicKey(v.cfg.AlipayPublicKey)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: alipay public key: %v", ErrWebhookNotConfigured, err)
	}
	sig, err := base64.StdEncoding.DecodeString(signB64)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: sign base64: %v", ErrWebhookBadSignature, err)
	}
	digest := sha256.Sum256([]byte(signing))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], sig); err != nil {
		return WebhookOrder{}, ErrWebhookBadSignature
	}

	if appID := params.Get("app_id"); v.cfg.AlipayAppID != "" && appID != "" && appID != v.cfg.AlipayAppID {
		return WebhookOrder{}, fmt.Errorf("%w: app_id mismatch", ErrWebhookBadSignature)
	}
	switch params.Get("trade_status") {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
	default:
		return WebhookOrder{}, ErrWebhookNotPaid
	}
	orderID := params.Get("out_trade_no")
	if orderID == "" {
		return WebhookOrder{}, fmt.Errorf("%w: missing out_trade_no", ErrWebhookBadPayload)
	}
	return WebhookOrder{OrderID: orderID, GatewayOrderID: params.Get("trade_no")}, nil
}

// ---- 微信支付 v3 ----

// VerifyWeChat 校验微信支付 v3 异步通知：
// Wechatpay-Signature（平台公钥 RSA-SHA256，签 ts\nnonce\nbody\n）+ resource AES-256-GCM 解密。
func (v *WebhookVerifier) VerifyWeChat(body []byte, signature, timestamp, nonce string) (WebhookOrder, error) {
	if v.cfg.WeChatPlatformPublicKey == "" || v.cfg.WeChatAPIKey == "" {
		return WebhookOrder{}, ErrWebhookNotConfigured
	}
	if signature == "" || timestamp == "" || nonce == "" {
		return WebhookOrder{}, fmt.Errorf("%w: missing Wechatpay-* headers", ErrWebhookBadSignature)
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: bad timestamp", ErrWebhookBadSignature)
	}
	age := time.Since(time.Unix(ts, 0))
	if age < -webhookTolerance || age > webhookTolerance {
		return WebhookOrder{}, ErrWebhookReplay
	}

	pub, err := parsePublicKey(v.cfg.WeChatPlatformPublicKey)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: wechat platform public key: %v", ErrWebhookNotConfigured, err)
	}
	sig, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: signature base64: %v", ErrWebhookBadSignature, err)
	}
	message := timestamp + "\n" + nonce + "\n" + string(body) + "\n"
	digest := sha256.Sum256([]byte(message))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], sig); err != nil {
		return WebhookOrder{}, ErrWebhookBadSignature
	}

	var notify struct {
	 EventType string `json:"event_type"`
		Resource  struct {
			Algorithm       string `json:"algorithm"`
			Nonce           string `json:"nonce"`
			AssociatedData  string `json:"associated_data"`
			Ciphertext      string `json:"ciphertext"`
		} `json:"resource"`
	}
	if err := json.Unmarshal(body, &notify); err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: %v", ErrWebhookBadPayload, err)
	}
	if notify.EventType != "TRANSACTION.SUCCESS" {
		return WebhookOrder{}, ErrWebhookNotPaid
	}

	plaintext, err := decryptAES256GCM(
		[]byte(v.cfg.WeChatAPIKey),
		notify.Resource.Nonce,
		notify.Resource.AssociatedData,
		notify.Resource.Ciphertext,
	)
	if err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: resource decrypt: %v", ErrWebhookBadSignature, err)
	}
	var txn struct {
		OutTradeNo     string `json:"out_trade_no"`
		TransactionID  string `json:"transaction_id"`
		TradeState     string `json:"trade_state"`
	}
	if err := json.Unmarshal(plaintext, &txn); err != nil {
		return WebhookOrder{}, fmt.Errorf("%w: %v", ErrWebhookBadPayload, err)
	}
	if txn.OutTradeNo == "" {
		return WebhookOrder{}, fmt.Errorf("%w: missing out_trade_no", ErrWebhookBadPayload)
	}
	if txn.TradeState != "" && txn.TradeState != "SUCCESS" {
		return WebhookOrder{}, ErrWebhookNotPaid
	}
	return WebhookOrder{OrderID: txn.OutTradeNo, GatewayOrderID: txn.TransactionID}, nil
}

// decryptAES256GCM 用 API v3 密钥解密回调 resource（AEAD_AES_256_GCM）。
func decryptAES256GCM(key []byte, nonce, associatedData, ciphertextB64 string) ([]byte, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("api key must be 32 bytes")
	}
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	// Open 对 nonce 长度非法会 panic，先显式校验（GCM 标准 nonce 为 12 字节）
	if len(nonce) != gcm.NonceSize() {
		return nil, fmt.Errorf("nonce must be %d bytes", gcm.NonceSize())
	}
	return gcm.Open(nil, []byte(nonce), ciphertext, []byte(associatedData))
}

// parsePublicKey 兼容 PEM 与裸 base64（PKIX/PKCS1）两种公钥格式。
func parsePublicKey(raw string) (*rsa.PublicKey, error) {
	pem := strings.TrimSpace(raw)
	if !strings.Contains(pem, "-----BEGIN") {
		pem = "-----BEGIN PUBLIC KEY-----\n" + pem + "\n-----END PUBLIC KEY-----"
	}
	block := decodePEM([]byte(pem))
	if block == nil {
		return nil, fmt.Errorf("invalid PEM")
	}
	if pub, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rsaPub, ok := pub.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
		return nil, fmt.Errorf("not an RSA public key")
	}
	return x509.ParsePKCS1PublicKey(block.Bytes)
}

func decodePEM(pemBytes []byte) *pem.Block {
	block, _ := pem.Decode(pemBytes)
	return block
}

func hexDecode(s string) ([]byte, error) {
	return hex.DecodeString(s)
}

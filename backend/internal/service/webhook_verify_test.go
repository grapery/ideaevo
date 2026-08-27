package service

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
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
	"testing"
	"time"
)

func TestVerifyStripe(t *testing.T) {
	verifier := NewWebhookVerifier(PaymentConfig{StripeWebhookSecret: "whsec_test"})
	body := []byte(`{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_test_1","client_reference_id":"order_123","payment_status":"paid"}}}`)

	now := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte("whsec_test"))
	mac.Write([]byte(fmt.Sprintf("%d.%s", now, body)))
	sig := hex.EncodeToString(mac.Sum(nil))
	header := fmt.Sprintf("t=%d,v1=%s", now, sig)

	order, err := verifier.VerifyStripe(body, header)
	if err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	if order.OrderID != "order_123" || order.GatewayOrderID != "cs_test_1" {
		t.Fatalf("unexpected order: %+v", order)
	}

	// 篡改 body 后签名不匹配
	if _, err := verifier.VerifyStripe([]byte(strings.Replace(string(body), "order_123", "order_999", 1)), header); !errors.Is(err, ErrWebhookBadSignature) {
		t.Fatalf("tampered body should fail signature check, got %v", err)
	}

	// 时间戳过期（重放）
	stale := time.Now().Add(-10 * time.Minute).Unix()
	if _, err := verifier.VerifyStripe(body, fmt.Sprintf("t=%d,v1=%s", stale, sig)); !errors.Is(err, ErrWebhookReplay) {
		t.Fatalf("stale timestamp should be rejected, got %v", err)
	}

	// 非支付成功事件不入账
	other := []byte(`{"id":"evt_2","type":"checkout.session.expired","data":{"object":{"id":"cs_test_2","client_reference_id":"order_123"}}}`)
	mac2 := hmac.New(sha256.New, []byte("whsec_test"))
	mac2.Write([]byte(fmt.Sprintf("%d.%s", now, other)))
	if _, err := verifier.VerifyStripe(other, fmt.Sprintf("t=%d,v1=%s", now, hex.EncodeToString(mac2.Sum(nil)))); !errors.Is(err, ErrWebhookNotPaid) {
		t.Fatalf("non-success event should be rejected, got %v", err)
	}

	// 未配置 secret 时 fail closed
	if _, err := NewWebhookVerifier(PaymentConfig{}).VerifyStripe(body, header); !errors.Is(err, ErrWebhookNotConfigured) {
		t.Fatalf("missing secret should fail closed, got %v", err)
	}
}

func TestVerifyAlipay(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: x509.MarshalPKCS1PublicKey(&key.PublicKey)})
	verifier := NewWebhookVerifier(PaymentConfig{AlipayAppID: "app_1", AlipayPublicKey: string(pubPEM)})

	build := func(status string) []byte {
		params := map[string]string{
			"app_id":      "app_1",
			"out_trade_no": "order_123",
			"trade_no":    "202401010001",
			"trade_status": status,
			"total_amount": "19.90",
		}
		keys := make([]string, 0, len(params))
		for k := range params {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			parts = append(parts, k+"="+params[k])
		}
		signing := strings.Join(parts, "&")
		digest := sha256.Sum256([]byte(signing))
		sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
		if err != nil {
			t.Fatal(err)
		}
		form := url.Values{}
		for k, v := range params {
			form.Set(k, v)
		}
		form.Set("sign", base64.StdEncoding.EncodeToString(sig))
		form.Set("sign_type", "RSA2")
		return []byte(form.Encode())
	}

	order, err := verifier.VerifyAlipay(build("TRADE_SUCCESS"))
	if err != nil {
		t.Fatalf("valid notification rejected: %v", err)
	}
	if order.OrderID != "order_123" || order.GatewayOrderID != "202401010001" {
		t.Fatalf("unexpected order: %+v", order)
	}

	// 签名验证通过但非成功状态：不入账
	if _, err := verifier.VerifyAlipay(build("WAIT_BUYER_PAY")); !errors.Is(err, ErrWebhookNotPaid) {
		t.Fatalf("unpaid status should be rejected, got %v", err)
	}

	// 用另一个密钥伪造签名
	forgedKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	params := url.Values{"out_trade_no": {"order_123"}, "trade_status": {"TRADE_SUCCESS"}}
	digest := sha256.Sum256([]byte(params.Encode()))
	sig, _ := rsa.SignPKCS1v15(rand.Reader, forgedKey, crypto.SHA256, digest[:])
	params.Set("sign", base64.StdEncoding.EncodeToString(sig))
	params.Set("sign_type", "RSA2")
	if _, err := verifier.VerifyAlipay([]byte(params.Encode())); !errors.Is(err, ErrWebhookBadSignature) {
		t.Fatalf("forged signature should fail, got %v", err)
	}

	if _, err := NewWebhookVerifier(PaymentConfig{}).VerifyAlipay(build("TRADE_SUCCESS")); !errors.Is(err, ErrWebhookNotConfigured) {
		t.Fatalf("missing public key should fail closed, got %v", err)
	}
}

func TestVerifyWeChat(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: x509.MarshalPKCS1PublicKey(&key.PublicKey)})
	apiKey := "0123456789abcdef0123456789abcdef" // 32 bytes
	verifier := NewWebhookVerifier(PaymentConfig{WeChatAPIKey: apiKey, WeChatPlatformPublicKey: string(pubPEM)})

	build := func(eventType, tradeState string) (body []byte, sigHeader string, tsHeader string, nonceHeader string) {
		txn := map[string]string{"out_trade_no": "order_123", "transaction_id": "4200001234", "trade_state": tradeState}
		plaintext, _ := json.Marshal(txn)
		nonce := "0123456789ab"
		block, _ := aes.NewCipher([]byte(apiKey))
		gcm, _ := cipher.NewGCM(block)
		ct := gcm.Seal(nil, []byte(nonce), plaintext, []byte("transaction"))
		notify := map[string]any{
			"id":         "notify-1",
			"event_type": eventType,
			"resource": map[string]string{
				"algorithm":        "AEAD_AES_256_GCM",
				"nonce":            nonce,
				"associated_data":  "transaction",
				"ciphertext":       base64.StdEncoding.EncodeToString(ct),
			},
		}
		body, _ = json.Marshal(notify)

		ts := strconv.FormatInt(time.Now().Unix(), 10)
		message := ts + "\n" + nonce + "\n" + string(body) + "\n"
		digest := sha256.Sum256([]byte(message))
		sig, _ := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
		return body, base64.StdEncoding.EncodeToString(sig), ts, nonce
	}

	body, sig, ts, nonce := build("TRANSACTION.SUCCESS", "SUCCESS")
	order, err := verifier.VerifyWeChat(body, sig, ts, nonce)
	if err != nil {
		t.Fatalf("valid notification rejected: %v", err)
	}
	if order.OrderID != "order_123" || order.GatewayOrderID != "4200001234" {
		t.Fatalf("unexpected order: %+v", order)
	}

	// 非成功事件不入账
	body, sig, ts, nonce = build("REFUND.SUCCESS", "SUCCESS")
	if _, err := verifier.VerifyWeChat(body, sig, ts, nonce); !errors.Is(err, ErrWebhookNotPaid) {
		t.Fatalf("refund event should not mark paid, got %v", err)
	}

	// 篡改 body 后签名失效
	body, sig, ts, nonce = build("TRANSACTION.SUCCESS", "SUCCESS")
	tampered := []byte(strings.Replace(string(body), "notify-1", "notify-9", 1))
	if _, err := verifier.VerifyWeChat(tampered, sig, ts, nonce); !errors.Is(err, ErrWebhookBadSignature) {
		t.Fatalf("tampered body should fail signature check, got %v", err)
	}

	// 时间戳过期
	_, sig2, _, nonce2 := build("TRANSACTION.SUCCESS", "SUCCESS")
	stale := strconv.FormatInt(time.Now().Add(-10*time.Minute).Unix(), 10)
	if _, err := verifier.VerifyWeChat(body, sig2, stale, nonce2); !errors.Is(err, ErrWebhookReplay) {
		t.Fatalf("stale timestamp should be rejected, got %v", err)
	}
}

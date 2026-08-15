package service

// SendAliyunOTPCode sends a mainland-China OTP via Alibaba Cloud SMS OpenAPI SendSms (2017-05-25).
// Credential resolution and env names align with grapery/internal/service/sms_aliyun.go.

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v5/client"
	util "github.com/alibabacloud-go/tea-utils/v2/service"
	"github.com/alibabacloud-go/tea/tea"
	credential "github.com/aliyun/credentials-go/credentials"
)

const (
	defaultAliyunSMSSignName     = "上海秩量科技"
	defaultAliyunSMSTemplateCode = "SMS_333971751"
)

func aliyunSMSSignName() string {
	if v := strings.TrimSpace(os.Getenv("ALIYUN_SMS_SIGN_NAME")); v != "" {
		return v
	}
	return defaultAliyunSMSSignName
}

func aliyunSMSTemplateCode() string {
	if v := strings.TrimSpace(os.Getenv("ALIYUN_SMS_TEMPLATE_CODE")); v != "" {
		return v
	}
	return defaultAliyunSMSTemplateCode
}

func aliyunSMSAccessKeyID() string {
	for _, key := range []string{
		"ALIYUN_SMS_ACCESS_KEY_ID",
		"ALIYUN_SMS_ACCESS_ID",
		"ALIYUN_ACCESS_KEY_ID",
		"ALIYUN_OSS_ACCESS_KEY_ID",
	} {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return ""
}

func aliyunSMSAccessKeySecret() string {
	for _, key := range []string{
		"ALIYUN_SMS_ACCESS_KEY_SECRET",
		"ALIYUN_SMS_ACCESS_SECRET",
		"ALIYUN_ACCESS_KEY_SECRET",
		"ALIYUN_OSS_ACCESS_KEY_SECRET",
	} {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return ""
}

func smsEnvTruthy(key string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes"
}

// smsAliyunConfigured reports whether real Aliyun SMS can be sent (keys or ECS RAM chain).
func smsAliyunConfigured() bool {
	if aliyunSMSAccessKeyID() != "" && aliyunSMSAccessKeySecret() != "" {
		return true
	}
	return smsEnvTruthy("ALIYUN_SMS_USE_DEFAULT_CREDENTIAL")
}

func maskChinaPhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if len(phone) < 7 {
		return "***"
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

// SendAliyunOTPCode sends a 6-digit verification SMS via Alibaba Cloud SMS (China).
func SendAliyunOTPCode(domesticPhone, code string) error {
	domesticPhone = strings.TrimSpace(domesticPhone)
	if domesticPhone == "" {
		return fmt.Errorf("empty phone")
	}

	signName := aliyunSMSSignName()
	templateCode := aliyunSMSTemplateCode()

	accessKeyID := aliyunSMSAccessKeyID()
	accessKeySecret := aliyunSMSAccessKeySecret()
	useDefaultChain := smsEnvTruthy("ALIYUN_SMS_USE_DEFAULT_CREDENTIAL")

	credentialMode := "none"
	var cred credential.Credential
	var err error
	switch {
	case accessKeyID != "" && accessKeySecret != "":
		credentialMode = "access_key"
		cred, err = credential.NewCredential(&credential.Config{
			Type:            tea.String("access_key"),
			AccessKeyId:     tea.String(accessKeyID),
			AccessKeySecret: tea.String(accessKeySecret),
		})
	case useDefaultChain:
		credentialMode = "default_chain"
		cred, err = credential.NewCredential(nil)
	default:
		log.Printf("[sms] aliyun not configured phone=%s sign=%s template=%s",
			maskChinaPhone(domesticPhone), signName, templateCode)
		return fmt.Errorf("aliyun SMS not configured")
	}
	if err != nil {
		return fmt.Errorf("aliyun sms credential: %w", err)
	}

	region := strings.TrimSpace(os.Getenv("ALIYUN_SMS_REGION"))
	if region == "" {
		region = "cn-hangzhou"
	}
	endpoint := strings.TrimSpace(os.Getenv("ALIYUN_SMS_ENDPOINT"))
	if endpoint == "" {
		endpoint = "dysmsapi.aliyuncs.com"
	}

	cfg := &openapi.Config{
		Credential: cred,
		RegionId:   tea.String(region),
		Endpoint:   tea.String(endpoint),
	}
	client, err := dysmsapi.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("aliyun sms client: %w", err)
	}

	paramJSON, err := json.Marshal(map[string]string{"code": code})
	if err != nil {
		return fmt.Errorf("sms template param: %w", err)
	}

	req := &dysmsapi.SendSmsRequest{
		PhoneNumbers:  tea.String(domesticPhone),
		SignName:      tea.String(signName),
		TemplateCode:  tea.String(templateCode),
		TemplateParam: tea.String(string(paramJSON)),
	}
	runtime := &util.RuntimeOptions{}

	log.Printf("[sms] send attempt phone=%s sign=%s template=%s mode=%s region=%s",
		maskChinaPhone(domesticPhone), signName, templateCode, credentialMode, region)

	resp, err := client.SendSmsWithOptions(req, runtime)
	if err != nil {
		return wrapAliyunSendSmsError(err)
	}
	if err := validateSendSmsResponse(resp); err != nil {
		return err
	}

	log.Printf("[sms] send succeeded phone=%s", maskChinaPhone(domesticPhone))
	return nil
}

func wrapAliyunSendSmsError(err error) error {
	var sdkErr *tea.SDKError
	if t, ok := err.(*tea.SDKError); ok {
		sdkErr = t
	} else {
		return fmt.Errorf("aliyun SendSms: %w", err)
	}

	msg := strings.TrimSpace(tea.StringValue(sdkErr.Message))
	if msg == "" {
		msg = err.Error()
	}
	return fmt.Errorf("aliyun SendSms: %s", msg)
}

func validateSendSmsResponse(resp *dysmsapi.SendSmsResponse) error {
	if resp == nil || resp.Body == nil {
		return fmt.Errorf("aliyun sms: empty response")
	}
	code := smsStrPtr(resp.Body.Code)
	if code != "" && code != "OK" {
		return fmt.Errorf("aliyun sms failed: %s %s", code, smsStrPtr(resp.Body.Message))
	}
	return nil
}

func smsStrPtr(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

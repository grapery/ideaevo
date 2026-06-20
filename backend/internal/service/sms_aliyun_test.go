package service

import (
	"strings"
	"testing"

	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v5/client"
	"github.com/alibabacloud-go/tea/tea"
)

func TestValidateSendSmsResponse_nilResponse(t *testing.T) {
	err := validateSendSmsResponse(nil)
	if err == nil || !strings.Contains(err.Error(), "empty response") {
		t.Fatalf("got %v", err)
	}
}

func TestValidateSendSmsResponse_ok(t *testing.T) {
	err := validateSendSmsResponse(&dysmsapi.SendSmsResponse{
		Body: &dysmsapi.SendSmsResponseBody{
			Code:    tea.String("OK"),
			Message: tea.String("OK"),
		},
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSendAliyunOTPCode_emptyPhone(t *testing.T) {
	if err := SendAliyunOTPCode("", "123456"); err == nil {
		t.Fatal("want error for empty phone")
	}
}

func TestAliyunSMSDefaults(t *testing.T) {
	t.Setenv("ALIYUN_SMS_SIGN_NAME", "")
	t.Setenv("ALIYUN_SMS_TEMPLATE_CODE", "")
	if got := aliyunSMSSignName(); got != defaultAliyunSMSSignName {
		t.Fatalf("sign default: got %q want %q", got, defaultAliyunSMSSignName)
	}
	if got := aliyunSMSTemplateCode(); got != defaultAliyunSMSTemplateCode {
		t.Fatalf("template default: got %q want %q", got, defaultAliyunSMSTemplateCode)
	}
}

func TestSmsAliyunConfigured_accessKey(t *testing.T) {
	t.Setenv("ALIYUN_SMS_USE_DEFAULT_CREDENTIAL", "")
	t.Setenv("ALIYUN_SMS_ACCESS_KEY_ID", "id")
	t.Setenv("ALIYUN_SMS_ACCESS_KEY_SECRET", "secret")
	if !smsAliyunConfigured() {
		t.Fatal("expected configured with access keys")
	}
}

func TestSmsAliyunConfigured_defaultChain(t *testing.T) {
	t.Setenv("ALIYUN_SMS_ACCESS_KEY_ID", "")
	t.Setenv("ALIYUN_SMS_ACCESS_KEY_SECRET", "")
	t.Setenv("ALIYUN_SMS_USE_DEFAULT_CREDENTIAL", "1")
	if !smsAliyunConfigured() {
		t.Fatal("expected configured with default credential chain")
	}
}

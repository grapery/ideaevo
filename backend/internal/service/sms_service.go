package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/model"
	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v4/client"
	"github.com/alibabacloud-go/tea/tea"
	"gorm.io/gorm"
)

type SMSService struct {
	db           *gorm.DB
	client       *dysmsapi.Client
	signName     string
	templateCode string
	enabled      bool
}

func NewSMSService(db *gorm.DB, cfg *config.Config) (*SMSService, error) {
	s := &SMSService{
		db:           db,
		signName:     cfg.AliyunSMSSignName,
		templateCode: cfg.AliyunSMSTemplateCode,
	}

	if cfg.AliyunAccessKeyID == "" || cfg.AliyunSMSSignName == "" || cfg.AliyunSMSTemplateCode == "" {
		return s, nil
	}

	conf := &openapi.Config{
		AccessKeyId:     tea.String(cfg.AliyunAccessKeyID),
		AccessKeySecret: tea.String(cfg.AliyunAccessKeySecret),
		Endpoint:        tea.String("dysmsapi.aliyuncs.com"),
	}
	client, err := dysmsapi.NewClient(conf)
	if err != nil {
		return nil, err
	}
	s.client = client
	s.enabled = true
	return s, nil
}

func (s *SMSService) Enabled() bool {
	return s != nil && s.enabled
}

func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashOTP(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

func (s *SMSService) SendOTP(phone, purpose string) error {
	phone = normalizePhone(phone)
	if !phonePattern.MatchString(phone) {
		return errors.New("手机号格式不正确")
	}

	var recent model.PhoneVerification
	if err := s.db.Where("phone = ? AND created_at > ?", phone, time.Now().Add(-60*time.Second)).
		Order("created_at DESC").First(&recent).Error; err == nil {
		return errors.New("请稍后再获取验证码")
	}

	var todayCount int64
	start := time.Now().Truncate(24 * time.Hour)
	s.db.Model(&model.PhoneVerification{}).
		Where("phone = ? AND created_at >= ?", phone, start).
		Count(&todayCount)
	if todayCount >= 10 {
		return errors.New("今日验证码发送次数已达上限")
	}

	code, err := generateOTP()
	if err != nil {
		return err
	}

	if s.Enabled() {
		req := &dysmsapi.SendSmsRequest{
			PhoneNumbers:  tea.String(phone),
			SignName:      tea.String(s.signName),
			TemplateCode:  tea.String(s.templateCode),
			TemplateParam: tea.String(fmt.Sprintf(`{"code":"%s"}`, code)),
		}
		resp, err := s.client.SendSms(req)
		if err != nil {
			return err
		}
		if resp.Body != nil && resp.Body.Code != nil && *resp.Body.Code != "OK" {
			return fmt.Errorf("sms failed: %s", tea.StringValue(resp.Body.Message))
		}
	} else {
		log.Printf("[sms] dev mode OTP for %s (%s): %s", phone, purpose, code)
	}

	s.db.Where("phone = ? AND purpose = ?", phone, purpose).Delete(&model.PhoneVerification{})
	rec := model.PhoneVerification{
		Phone:     phone,
		CodeHash:  hashOTP(code),
		Purpose:   purpose,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	return s.db.Create(&rec).Error
}

func (s *SMSService) VerifyOTP(phone, code, purpose string) error {
	phone = normalizePhone(phone)
	var rec model.PhoneVerification
	err := s.db.Where("phone = ? AND purpose = ?", phone, purpose).
		Order("created_at DESC").First(&rec).Error
	if err != nil {
		return errors.New("验证码无效或已过期")
	}
	if time.Now().After(rec.ExpiresAt) {
		s.db.Delete(&rec)
		return errors.New("验证码已过期")
	}
	if hashOTP(code) != rec.CodeHash {
		return errors.New("验证码错误")
	}
	s.db.Delete(&rec)
	return nil
}

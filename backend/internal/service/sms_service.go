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
	"gorm.io/gorm"
)

type SMSService struct {
	db      *gorm.DB
	enabled bool
}

func NewSMSService(db *gorm.DB, _ *config.Config) (*SMSService, error) {
	s := &SMSService{db: db}
	if smsAliyunConfigured() {
		s.enabled = true
	}
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
		if err := SendAliyunOTPCode(phone, code); err != nil {
			return errors.New("短信发送失败，请稍后重试")
		}
	} else {
		log.Printf("[sms] dev mode OTP for %s (%s): %s", maskChinaPhone(phone), purpose, code)
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

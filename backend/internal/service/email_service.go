package service

import (
	"fmt"
	"log"

	"github.com/wanye/ideaevo/internal/config"
	"gopkg.in/gomail.v2"
)

type EmailService struct {
	host     string
	port     int
	user     string
	password string
	from     string
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{
		host:     cfg.SMTPHost,
		port:     cfg.SMTPPort,
		user:     cfg.SMTPUser,
		password: cfg.SMTPPassword,
		from:     cfg.SMTPFrom,
	}
}

func (s *EmailService) SendVerificationEmail(to, token, frontendURL string) error {
	link := fmt.Sprintf("%s/verify-email?token=%s", frontendURL, token)
	body := fmt.Sprintf("请点击以下链接验证邮箱：\n\n%s\n\n如果这不是你的操作，请忽略此邮件。", link)
	return s.send(to, "万叶 - 验证邮箱", body)
}

func (s *EmailService) SendPasswordResetEmail(to, token, frontendURL string) error {
	link := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, token)
	body := fmt.Sprintf("请点击以下链接重置密码：\n\n%s\n\n如果这不是你的操作，请忽略此邮件。", link)
	return s.send(to, "万叶 - 重置密码", body)
}

func (s *EmailService) send(to, subject, body string) error {
	if s.host == "" {
		log.Printf("[EMAIL] to=%s subject=%s (SMTP not configured, skipping)", to, subject)
		return nil
	}

	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	d := gomail.NewDialer(s.host, s.port, s.user, s.password)
	if err := d.DialAndSend(m); err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	return nil
}

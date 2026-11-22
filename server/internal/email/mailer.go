package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"time"

	"nijghor/server/internal/config"
)

type Mailer interface {
	SendVerificationCode(recipientEmail, code string) error
}

func NewMailer(cfg *config.Config) Mailer {
	switch cfg.EmailProvider {
	case "resend":
		return &ResendMailer{
			APIKey: cfg.ResendAPIKey,
			From:   cfg.SMTPFrom,
			Client: &http.Client{Timeout: 10 * time.Second},
		}
	case "smtp":
		return &SMTPMailer{
			Host: cfg.SMTPHost,
			Port: cfg.SMTPPort,
			User: cfg.SMTPUser,
			Pass: cfg.SMTPPass,
			From: cfg.SMTPFrom,
		}
	default:
		return &MockMailer{}
	}
}

// ----------------- Mock Mailer (Local Dev & Testing) -----------------

type MockMailer struct{}

func (m *MockMailer) SendVerificationCode(recipientEmail, code string) error {
	log.Printf("[EMAIL-MOCK] ---------------------------------------------")
	log.Printf("[EMAIL-MOCK] TO: %s", recipientEmail)
	log.Printf("[EMAIL-MOCK] SUBJECT: Your Nijghor Verification Code")
	log.Printf("[EMAIL-MOCK] CODE: >>> %s <<< (Valid for 10 minutes)", code)
	log.Printf("[EMAIL-MOCK] ---------------------------------------------")
	return nil
}

// ----------------- SMTP Mailer -----------------

type SMTPMailer struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

func (s *SMTPMailer) SendVerificationCode(recipientEmail, code string) error {
	auth := smtp.PlainAuth("", s.User, s.Pass, s.Host)
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)

	body := fmt.Sprintf("Subject: Your Nijghor Verification Code\r\n"+
		"From: %s\r\n"+
		"To: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n"+
		"Your Nijghor verification code is:\r\n\r\n"+
		"      %s\r\n\r\n"+
		"This code expires in 10 minutes. If you did not request this, please ignore this email.\r\n",
		s.From, recipientEmail, code)

	return smtp.SendMail(addr, auth, s.From, []string{recipientEmail}, []byte(body))
}

// ----------------- Resend Mailer -----------------

type ResendMailer struct {
	APIKey string
	From   string
	Client *http.Client
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text"`
}

func (r *ResendMailer) SendVerificationCode(recipientEmail, code string) error {
	if r.APIKey == "" {
		return fmt.Errorf("resend API key is empty")
	}

	payload := resendRequest{
		From:    r.From,
		To:      []string{recipientEmail},
		Subject: "Your Nijghor Verification Code",
		Text: fmt.Sprintf("Your Nijghor verification code is: %s\n\nValid for 10 minutes.", code),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend email failed with status: %d", resp.StatusCode)
	}
	return nil
}

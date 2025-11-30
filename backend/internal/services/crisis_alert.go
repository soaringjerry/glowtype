package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/soaringjerry/glowtype/internal/database"

	"gorm.io/gorm"
)

// CrisisAlertService handles Level 3 crisis notifications
type CrisisAlertService struct {
	db           *gorm.DB
	configLoader *CrisisConfigLoader
	httpClient   *http.Client
}

// CrisisAlertPayload contains information about a crisis alert
type CrisisAlertPayload struct {
	SessionID       string    `json:"sessionId"`
	Level           int       `json:"level"`
	Triggers        []string  `json:"triggers"`
	TriggerCategory string    `json:"triggerCategory"`
	Message         string    `json:"message"`
	Glowtype        string    `json:"glowtype"`
	Language        string    `json:"language"`
	DetectedAt      time.Time `json:"detectedAt"`
}

// NewCrisisAlertService creates a new alert service
func NewCrisisAlertService(db *gorm.DB, configLoader *CrisisConfigLoader) *CrisisAlertService {
	return &CrisisAlertService{
		db:           db,
		configLoader: configLoader,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendLevel3Alert sends an alert if Level 3 crisis is detected and alerts are enabled
func (s *CrisisAlertService) SendLevel3Alert(payload CrisisAlertPayload) {
	settings, err := database.GetCrisisSettings(s.db, nil)
	if err != nil {
		log.Printf("[CrisisAlert] Failed to get settings: %v", err)
		return
	}

	if !settings.Level3AlertEnabled {
		return
	}

	// Send webhook if configured
	if settings.Level3AlertWebhook != "" {
		go s.sendWebhook(settings.Level3AlertWebhook, payload)
	}

	// Send email if configured
	if settings.Level3AlertEmail != "" {
		go s.sendEmail(settings.Level3AlertEmail, payload)
	}
}

// sendWebhook sends alert to a webhook URL (Slack/Discord compatible)
func (s *CrisisAlertService) sendWebhook(webhookURL string, payload CrisisAlertPayload) {
	// Format for Slack/Discord
	var body map[string]interface{}

	if strings.Contains(webhookURL, "discord") {
		// Discord webhook format
		body = map[string]interface{}{
			"embeds": []map[string]interface{}{
				{
					"title":       "🚨 Level 3 Crisis Alert",
					"description": fmt.Sprintf("A Level 3 crisis signal was detected in a chat session."),
					"color":       16711680, // Red
					"fields": []map[string]interface{}{
						{"name": "Session ID", "value": payload.SessionID, "inline": true},
						{"name": "Glowtype", "value": payload.Glowtype, "inline": true},
						{"name": "Language", "value": payload.Language, "inline": true},
						{"name": "Category", "value": payload.TriggerCategory, "inline": true},
						{"name": "Triggers", "value": strings.Join(payload.Triggers, ", "), "inline": false},
						{"name": "Message Preview", "value": truncateMessage(payload.Message, 200), "inline": false},
					},
					"timestamp": payload.DetectedAt.Format(time.RFC3339),
				},
			},
		}
	} else {
		// Slack webhook format (default)
		body = map[string]interface{}{
			"text": "🚨 Level 3 Crisis Alert",
			"attachments": []map[string]interface{}{
				{
					"color": "danger",
					"fields": []map[string]interface{}{
						{"title": "Session ID", "value": payload.SessionID, "short": true},
						{"title": "Glowtype", "value": payload.Glowtype, "short": true},
						{"title": "Language", "value": payload.Language, "short": true},
						{"title": "Category", "value": payload.TriggerCategory, "short": true},
						{"title": "Triggers", "value": strings.Join(payload.Triggers, ", "), "short": false},
						{"title": "Message Preview", "value": truncateMessage(payload.Message, 200), "short": false},
					},
					"ts": payload.DetectedAt.Unix(),
				},
			},
		}
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		log.Printf("[CrisisAlert] Failed to marshal webhook body: %v", err)
		return
	}

	resp, err := s.httpClient.Post(webhookURL, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		log.Printf("[CrisisAlert] Failed to send webhook: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("[CrisisAlert] Webhook returned status %d", resp.StatusCode)
	} else {
		log.Printf("[CrisisAlert] Webhook sent successfully to %s", maskURL(webhookURL))
	}
}

// sendEmail sends alert via email
func (s *CrisisAlertService) sendEmail(toEmail string, payload CrisisAlertPayload) {
	// Get SMTP settings from environment
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	smtpFrom := os.Getenv("SMTP_FROM")

	if smtpHost == "" {
		log.Printf("[CrisisAlert] SMTP not configured, skipping email alert")
		return
	}

	if smtpPort == "" {
		smtpPort = "587"
	}
	if smtpFrom == "" {
		smtpFrom = smtpUser
	}

	subject := "🚨 Glowtype Level 3 Crisis Alert"
	body := fmt.Sprintf(`
Level 3 Crisis Alert Detected

Session ID: %s
Glowtype: %s
Language: %s
Category: %s
Detected At: %s

Triggers: %s

Message Preview:
%s

---
This is an automated alert from Glowtype Crisis Detection System.
Please review the session and take appropriate action if needed.
`,
		payload.SessionID,
		payload.Glowtype,
		payload.Language,
		payload.TriggerCategory,
		payload.DetectedAt.Format("2006-01-02 15:04:05 MST"),
		strings.Join(payload.Triggers, ", "),
		truncateMessage(payload.Message, 500),
	)

	msg := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		toEmail, subject, body))

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)

	err := smtp.SendMail(
		fmt.Sprintf("%s:%s", smtpHost, smtpPort),
		auth,
		smtpFrom,
		[]string{toEmail},
		msg,
	)

	if err != nil {
		log.Printf("[CrisisAlert] Failed to send email: %v", err)
	} else {
		log.Printf("[CrisisAlert] Email sent successfully to %s", maskEmail(toEmail))
	}
}

// truncateMessage truncates message to specified length
func truncateMessage(msg string, maxLen int) string {
	if len(msg) <= maxLen {
		return msg
	}
	return msg[:maxLen] + "..."
}

// maskURL masks sensitive parts of URL for logging
func maskURL(url string) string {
	if len(url) < 20 {
		return "***"
	}
	return url[:20] + "***"
}

// maskEmail masks email for logging
func maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***"
	}
	if len(parts[0]) <= 2 {
		return parts[0] + "@***"
	}
	return parts[0][:2] + "***@" + parts[1]
}

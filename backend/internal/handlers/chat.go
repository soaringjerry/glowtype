package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/models"
	"github.com/soaringjerry/glowtype/internal/services"
	"github.com/soaringjerry/glowtype/internal/utils"
	"gorm.io/gorm"
)

type ChatHandler struct {
	service *services.ChatService
	db      *gorm.DB
}

func NewChatHandler(service *services.ChatService, db *gorm.DB) *ChatHandler {
	return &ChatHandler{service: service, db: db}
}

func (h *ChatHandler) CreateSession(c *gin.Context) {
	var req models.ChatSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	resp := h.service.CreateSession(req)
	c.JSON(http.StatusOK, resp)
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	var req models.ChatMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	resp := h.service.Reply(req)
	c.JSON(http.StatusOK, resp)
}

// ChatAnalyticsRequest is the request body for tracking chat sessions
type ChatAnalyticsRequest struct {
	SessionID        string `json:"sessionId"`        // Frontend-generated session ID
	MessageCount     int    `json:"messageCount"`     // Total messages
	UserMessages     int    `json:"userMessages"`     // User's messages
	AIMessages       int    `json:"aiMessages"`       // AI's responses
	DurationSecs     int    `json:"durationSecs"`     // Session duration in seconds
	GlowtypeCode     string `json:"glowtypeCode"`     // User's glowtype if known
	Language         string `json:"language"`         // Session language
	HasCrisisContent bool   `json:"hasCrisisContent"` // Whether crisis keywords were detected
}

// TrackChatAnalytics records an anonymous chat session for analytics
// POST /api/chat/analytics
func (h *ChatHandler) TrackChatAnalytics(c *gin.Context) {
	var req ChatAnalyticsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// Extract anonymized info from request
	anonInfo := utils.ExtractAnonymizedInfo(c.Request)

	// Generate session ID if not provided
	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	// Create chat session record
	session := database.ChatSessionDB{
		SessionID:         sessionID,
		MessageCount:      req.MessageCount,
		UserMessages:      req.UserMessages,
		AIMessages:        req.AIMessages,
		DurationSecs:      req.DurationSecs,
		GlowtypeCode:      req.GlowtypeCode,
		Language:          req.Language,
		Region:            anonInfo.Region,
		DeviceType:        anonInfo.DeviceType,
		HourOfDay:         anonInfo.HourOfDay,
		HasCrisisKeywords: req.HasCrisisContent,
		StartedAt:         time.Now().Add(-time.Duration(req.DurationSecs) * time.Second),
		EndedAt:           time.Now(),
	}

	// Save to database (async, don't block response)
	go func() {
		h.db.Create(&session)
	}()

	c.JSON(http.StatusOK, gin.H{"success": true})
}


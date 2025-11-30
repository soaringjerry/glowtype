package handlers

import (
	"net/http"
	"strings"
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
	if !h.service.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
		return
	}

	var req models.ChatSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	resp := h.service.CreateSession(req)
	c.JSON(http.StatusOK, resp)
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	if !h.service.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
		return
	}

	var req models.ChatMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	resp := h.service.Reply(req)
	c.JSON(http.StatusOK, resp)
}

// GenerateInsight handles single-turn insight generation via provider-backed AI.
func (h *ChatHandler) GenerateInsight(c *gin.Context) {
	if !h.service.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
		return
	}

	var req struct {
		SystemPrompt string `json:"systemPrompt"`
		Prompt       string `json:"prompt"`
		Language     string `json:"language"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if strings.TrimSpace(req.SystemPrompt) == "" || strings.TrimSpace(req.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing prompt"})
		return
	}

	text := h.service.GenerateInsight(req.SystemPrompt, req.Prompt, req.Language)
	c.JSON(http.StatusOK, gin.H{"reply": text})
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
	IsTest           bool   `json:"isTest"`           // Mark as test data (admin sessions)
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
	baseTime := time.Now().UTC().Truncate(time.Minute) // coarse timestamp for privacy

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
		IsTest:            req.IsTest,
		StartedAt:         baseTime,
		EndedAt:           baseTime,
	}

	// Save to database (async, don't block response)
	go func() {
		h.db.Create(&session)
	}()

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DebugSession returns debug information for a chat session (admin only)
// GET /api/chat/debug/:sessionId
func (h *ChatHandler) DebugSession(c *gin.Context) {
	sessionID := c.Param("sessionId")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing sessionId"})
		return
	}

	debugInfo := h.service.GetDebugInfo(sessionID)
	if debugInfo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	c.JSON(http.StatusOK, debugInfo)
}

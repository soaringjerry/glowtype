package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/models"
	"github.com/soaringjerry/glowtype/internal/services"
)

type ChatHandler struct {
	service *services.ChatService
}

func NewChatHandler(service *services.ChatService) *ChatHandler {
	return &ChatHandler{service: service}
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


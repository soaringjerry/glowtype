package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/models"
	"github.com/soaringjerry/glowtype/internal/services"
	"github.com/soaringjerry/glowtype/internal/utils"
)

type QuizHandler struct {
	service *services.QuizService
}

func NewQuizHandler(service *services.QuizService) *QuizHandler {
	return &QuizHandler{service: service}
}

func (h *QuizHandler) GetQuiz(c *gin.Context) {
	lang := c.Query("lang")
	if lang == "" {
		if al := c.GetHeader("Accept-Language"); al != "" {
			lang = al
		}
	}

	resp := h.service.GetQuiz(lang)
	c.JSON(http.StatusOK, resp)
}

func (h *QuizHandler) ScoreQuiz(c *gin.Context) {
	var req models.QuizScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// Extract anonymized metadata from request
	anonInfo := utils.ExtractAnonymizedInfo(c.Request)
	meta := models.RequestMeta{
		Region:      anonInfo.Region,
		DeviceType:  anonInfo.DeviceType,
		BrowserLang: anonInfo.BrowserLang,
		HourOfDay:   anonInfo.HourOfDay,
		Channel:     c.Query("channel"),   // UTM channel parameter
		EntryPoint:  c.Query("entry"),     // Entry point parameter
		UserAgent:   c.Request.UserAgent(),
		IsTest:      req.IsTest,           // Test data flag from admin sessions
	}

	resp := h.service.ScoreQuizWithMeta(req, meta)
	c.JSON(http.StatusOK, resp)
}

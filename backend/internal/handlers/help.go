package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/services"
)

type HelpHandler struct {
	service *services.HelpService
}

func NewHelpHandler(service *services.HelpService) *HelpHandler {
	return &HelpHandler{service: service}
}

func (h *HelpHandler) GetHelp(c *gin.Context) {
	lang := c.Query("lang")
	if lang == "" {
		if al := c.GetHeader("Accept-Language"); al != "" {
			lang = al
		}
	}

	resp := h.service.GetHelp(lang)
	c.JSON(http.StatusOK, resp)
}


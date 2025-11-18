package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/services"
)

type GlowtypeHandler struct {
	service *services.GlowtypeService
}

func NewGlowtypeHandler(service *services.GlowtypeService) *GlowtypeHandler {
	return &GlowtypeHandler{service: service}
}

func (h *GlowtypeHandler) GetGlowtype(c *gin.Context) {
	id := c.Param("id")
	lang := c.Query("lang")
	if lang == "" {
		if al := c.GetHeader("Accept-Language"); al != "" {
			lang = al
		}
	}

	resp, err := h.service.GetGlowtype(id, lang)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "glowtype not found"})
		return
	}

	c.JSON(http.StatusOK, resp)
}


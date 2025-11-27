package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
)

// GetGlowpediaContent exposes active chapters and glow sticks for the public app.
func GetGlowpediaContent(c *gin.Context) {
	var chapters []database.BookChapterDB
	if err := database.GetDB().
		Where("is_active = ?", true).
		Order("\"order\" asc").
		Find(&chapters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var sticks []database.GlowStickDB
	if err := database.GetDB().
		Where("is_active = ?", true).
		Order("\"order\" asc").
		Find(&sticks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"chapters":   chapters,
		"glowSticks": sticks,
	})
}

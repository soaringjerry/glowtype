package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
)

// RecordEventHandler records anonymous usage events
func RecordEventHandler(c *gin.Context) {
	var req struct {
		Event    string `json:"event"`    // quiz_complete, share_generate, ai_chat_start, ai_insight_use
		TypeCode string `json:"typeCode"` // Optional: for glowtype tracking
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	db := database.GetDB()
	today := time.Now().Format("2006-01-02")

	// Get or create today's stats
	var stats database.UsageStats
	db.Where("date = ?", today).FirstOrCreate(&stats, database.UsageStats{Date: today})

	// Update the appropriate counter
	switch req.Event {
	case "quiz_complete":
		db.Model(&stats).Update("quiz_completed", stats.QuizCompleted+1)

		// Also track glowtype distribution if provided
		if req.TypeCode != "" {
			var glowtypeStats database.GlowtypeStats
			result := db.Where("date = ? AND type_code = ?", today, req.TypeCode).First(&glowtypeStats)
			if result.Error != nil {
				// Create new
				glowtypeStats = database.GlowtypeStats{
					Date:     today,
					TypeCode: req.TypeCode,
					Count:    1,
				}
				db.Create(&glowtypeStats)
			} else {
				db.Model(&glowtypeStats).Update("count", glowtypeStats.Count+1)
			}
		}

	case "share_generate":
		db.Model(&stats).Update("share_generated", stats.ShareGenerated+1)

	case "ai_chat_start":
		db.Model(&stats).Update("ai_chats_started", stats.AIChatsStarted+1)

	case "ai_insight_use":
		db.Model(&stats).Update("ai_insight_used", stats.AIInsightUsed+1)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown event type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

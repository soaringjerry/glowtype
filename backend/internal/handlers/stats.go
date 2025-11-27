package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/utils"
	"gorm.io/datatypes"
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

// SubmitQuizResultHandler saves a complete quiz result (anonymous)
func SubmitQuizResultHandler(c *gin.Context) {
	var req struct {
		SessionID       string                  `json:"sessionId"`       // Anonymous session ID
		Answers         []database.AnswerRecord `json:"answers"`         // User's answers
		DimensionScores map[string]float64      `json:"dimensionScores"` // Computed scores
		ResultTypeCode  string                  `json:"resultTypeCode"`  // Final result
		Language        string                  `json:"language"`        // en or zh
		Source          string                  `json:"source"`          // web, app, embed
		Channel         string                  `json:"channel"`         // Distribution channel
		EntryPoint      string                  `json:"entryPoint"`      // Campaign/source
		Referrer        string                  `json:"referrer"`        // HTTP referrer
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Serialize JSON fields
	answersJSON, _ := json.Marshal(req.Answers)
	scoresJSON, _ := json.Marshal(req.DimensionScores)

	// Create quiz result record
	result := database.QuizResultDB{
		SessionID:       req.SessionID,
		Answers:         datatypes.JSON(answersJSON),
		DimensionScores: datatypes.JSON(scoresJSON),
		ResultTypeCode:  req.ResultTypeCode,
		Language:        req.Language,
		Source:          req.Source,
		Channel:         req.Channel,
		EntryPoint:      req.EntryPoint,
		Referrer:        req.Referrer,
		UserAgent:       c.GetHeader("User-Agent"),
	}

	// Extract anonymized info
	anonInfo := utils.ExtractAnonymizedInfo(c.Request)
	result.Region = anonInfo.Region
	result.DeviceType = anonInfo.DeviceType
	result.BrowserLang = anonInfo.BrowserLang
	result.HourOfDay = anonInfo.HourOfDay

	if err := database.GetDB().Create(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save result"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "id": result.ID})
}

// ========== Enhanced Analytics Handlers ==========

// RegionStat represents region statistics
type RegionStat struct {
	Region string `json:"region"`
	Count  int    `json:"count"`
}

// DeviceStat represents device type statistics
type DeviceStat struct {
	DeviceType string `json:"deviceType"`
	Count      int    `json:"count"`
}

// HourStat represents hourly statistics
type HourStat struct {
	Hour  int `json:"hour"`
	Count int `json:"count"`
}

// GetEnhancedStatsHandler returns detailed analytics for admin dashboard
// GET /api/admin/enhanced-stats
func GetEnhancedStatsHandler(c *gin.Context) {
	db := database.GetDB()
	daysStr := c.DefaultQuery("days", "14")
	days, _ := strconv.Atoi(daysStr)
	if days <= 0 || days > 90 {
		days = 14
	}

	startDate := time.Now().AddDate(0, 0, -days)

	var stats struct {
		// Quiz results analytics
		QuizByRegion []RegionStat `json:"quizByRegion"`
		QuizByDevice []DeviceStat `json:"quizByDevice"`
		QuizByHour   []HourStat   `json:"quizByHour"`
		QuizByLang   []struct {
			Language string `json:"language"`
			Count    int    `json:"count"`
		} `json:"quizByLang"`
		// Chat session analytics
		ChatStats struct {
			TotalSessions   int64   `json:"totalSessions"`
			TotalMessages   int64   `json:"totalMessages"`
			AvgMessages     float64 `json:"avgMessages"`
			AvgDurationSecs float64 `json:"avgDurationSecs"`
			CrisisSessions  int64   `json:"crisisSessions"`
		} `json:"chatStats"`
		ChatByRegion []RegionStat `json:"chatByRegion"`
		ChatByDevice []DeviceStat `json:"chatByDevice"`
		ChatByHour   []HourStat   `json:"chatByHour"`
	}

	// Quiz analytics by region
	db.Model(&database.QuizResultDB{}).
		Select("region, COUNT(*) as count").
		Where("created_at >= ? AND region != '' AND region != 'unknown'", startDate).
		Group("region").
		Order("count DESC").
		Limit(15).
		Scan(&stats.QuizByRegion)

	// Quiz analytics by device
	db.Model(&database.QuizResultDB{}).
		Select("device_type, COUNT(*) as count").
		Where("created_at >= ? AND device_type != ''", startDate).
		Group("device_type").
		Scan(&stats.QuizByDevice)

	// Quiz analytics by hour
	db.Model(&database.QuizResultDB{}).
		Select("hour_of_day as hour, COUNT(*) as count").
		Where("created_at >= ?", startDate).
		Group("hour_of_day").
		Order("hour_of_day").
		Scan(&stats.QuizByHour)

	// Quiz analytics by language
	db.Model(&database.QuizResultDB{}).
		Select("language, COUNT(*) as count").
		Where("created_at >= ? AND language != ''", startDate).
		Group("language").
		Scan(&stats.QuizByLang)

	// Chat session statistics
	db.Model(&database.ChatSessionDB{}).
		Where("started_at >= ?", startDate).
		Count(&stats.ChatStats.TotalSessions)

	db.Model(&database.ChatSessionDB{}).
		Where("started_at >= ?", startDate).
		Select("COALESCE(SUM(message_count), 0)").
		Scan(&stats.ChatStats.TotalMessages)

	if stats.ChatStats.TotalSessions > 0 {
		stats.ChatStats.AvgMessages = float64(stats.ChatStats.TotalMessages) / float64(stats.ChatStats.TotalSessions)
	}

	db.Model(&database.ChatSessionDB{}).
		Where("started_at >= ?", startDate).
		Select("COALESCE(AVG(duration_secs), 0)").
		Scan(&stats.ChatStats.AvgDurationSecs)

	db.Model(&database.ChatSessionDB{}).
		Where("started_at >= ? AND has_crisis_keywords = ?", startDate, true).
		Count(&stats.ChatStats.CrisisSessions)

	// Chat by region
	db.Model(&database.ChatSessionDB{}).
		Select("region, COUNT(*) as count").
		Where("started_at >= ? AND region != '' AND region != 'unknown'", startDate).
		Group("region").
		Order("count DESC").
		Limit(15).
		Scan(&stats.ChatByRegion)

	// Chat by device
	db.Model(&database.ChatSessionDB{}).
		Select("device_type, COUNT(*) as count").
		Where("started_at >= ? AND device_type != ''", startDate).
		Group("device_type").
		Scan(&stats.ChatByDevice)

	// Chat by hour
	db.Model(&database.ChatSessionDB{}).
		Select("hour_of_day as hour, COUNT(*) as count").
		Where("started_at >= ?", startDate).
		Group("hour_of_day").
		Order("hour_of_day").
		Scan(&stats.ChatByHour)

	c.JSON(http.StatusOK, stats)
}

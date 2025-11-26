package handlers

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/services"
)

// AdminAuthMiddleware checks for admin password
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		adminPassword := os.Getenv("ADMIN_PASSWORD")
		if adminPassword == "" {
			adminPassword = "admin123" // Default for development
		}

		token := c.GetHeader("Authorization")
		expected := "Bearer " + adminPassword

		if token != expected {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		c.Next()
	}
}

// AdminLoginHandler handles admin login
func AdminLoginHandler(c *gin.Context) {
	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "admin123"
	}

	if req.Password != adminPassword {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   adminPassword,
	})
}

// ============ Trait Dimensions CRUD ============

func ListDimensions(c *gin.Context) {
	var dims []database.TraitDimensionDB
	if err := database.GetDB().Order("display_order asc").Find(&dims).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dims)
}

func CreateDimension(c *gin.Context) {
	var dim database.TraitDimensionDB
	if err := c.ShouldBindJSON(&dim); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.GetDB().Create(&dim).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dim)
}

func UpdateDimension(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var dim database.TraitDimensionDB
	if err := database.GetDB().First(&dim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dimension not found"})
		return
	}
	if err := c.ShouldBindJSON(&dim); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	dim.ID = uint(id)
	if err := database.GetDB().Save(&dim).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dim)
}

func DeleteDimension(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.GetDB().Delete(&database.TraitDimensionDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============ Quiz Questions CRUD ============

func ListQuestions(c *gin.Context) {
	var questions []database.QuizQuestionDB
	if err := database.GetDB().Where("is_active = ?", true).Order("\"order\" asc").Find(&questions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, questions)
}

func CreateQuestion(c *gin.Context) {
	var question database.QuizQuestionDB
	if err := c.ShouldBindJSON(&question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	question.IsActive = true
	question.Version = 1
	if err := database.GetDB().Create(&question).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, question)
}

func UpdateQuestion(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var question database.QuizQuestionDB
	if err := database.GetDB().First(&question, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
		return
	}
	if err := c.ShouldBindJSON(&question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	question.ID = uint(id)
	if err := database.GetDB().Save(&question).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, question)
}

func DeleteQuestion(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	// Soft delete by setting IsActive = false
	if err := database.GetDB().Model(&database.QuizQuestionDB{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============ Glowtypes CRUD ============

func ListGlowtypes(c *gin.Context) {
	var glowtypes []database.GlowtypeDB
	if err := database.GetDB().Where("is_active = ?", true).Order("type_code asc").Find(&glowtypes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, glowtypes)
}

func GetGlowtypeWithI18N(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var glowtype database.GlowtypeDB
	if err := database.GetDB().First(&glowtype, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Glowtype not found"})
		return
	}

	var i18n []database.GlowtypeI18NDB
	database.GetDB().Where("glowtype_id = ?", id).Find(&i18n)

	c.JSON(http.StatusOK, gin.H{
		"glowtype": glowtype,
		"i18n":     i18n,
	})
}

func CreateGlowtype(c *gin.Context) {
	var glowtype database.GlowtypeDB
	if err := c.ShouldBindJSON(&glowtype); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	glowtype.IsActive = true
	glowtype.Version = 1
	if err := database.GetDB().Create(&glowtype).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, glowtype)
}

func UpdateGlowtype(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var glowtype database.GlowtypeDB
	if err := database.GetDB().First(&glowtype, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Glowtype not found"})
		return
	}
	if err := c.ShouldBindJSON(&glowtype); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	glowtype.ID = uint(id)
	if err := database.GetDB().Save(&glowtype).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, glowtype)
}

func DeleteGlowtype(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.GetDB().Model(&database.GlowtypeDB{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============ Glowtype I18N ============

func CreateGlowtypeI18N(c *gin.Context) {
	var i18n database.GlowtypeI18NDB
	if err := c.ShouldBindJSON(&i18n); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.GetDB().Create(&i18n).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, i18n)
}

func UpdateGlowtypeI18N(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var i18n database.GlowtypeI18NDB
	if err := database.GetDB().First(&i18n, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "I18N record not found"})
		return
	}
	if err := c.ShouldBindJSON(&i18n); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	i18n.ID = uint(id)
	if err := database.GetDB().Save(&i18n).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, i18n)
}

// ============ Scoring Rules CRUD ============

func ListRules(c *gin.Context) {
	var rules []database.ScoringRuleDB
	if err := database.GetDB().Where("is_active = ?", true).Order("priority desc").Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rules)
}

func CreateRule(c *gin.Context) {
	var rule database.ScoringRuleDB
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.IsActive = true
	rule.Version = 1
	if err := database.GetDB().Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

func UpdateRule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var rule database.ScoringRuleDB
	if err := database.GetDB().First(&rule, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	}
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	rule.ID = uint(id)
	if err := database.GetDB().Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func DeleteRule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.GetDB().Model(&database.ScoringRuleDB{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============ Rule Debugging ============

func DebugRules(c *gin.Context) {
	var req struct {
		DimensionScores map[string]float64 `json:"dimensionScores"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	svc := services.NewScoringService(database.GetDB())
	result, err := svc.MatchGlowtype(req.DimensionScores, nil, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func ValidateRules(c *gin.Context) {
	svc := services.NewScoringService(database.GetDB())
	warnings, err := svc.ValidateRules(nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":    len(warnings) == 0,
		"warnings": warnings,
	})
}

// ============ AI Prompts CRUD ============

func ListPrompts(c *gin.Context) {
	var prompts []database.AIPromptDB
	if err := database.GetDB().Where("is_active = ?", true).Order("key asc").Find(&prompts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prompts)
}

func CreatePrompt(c *gin.Context) {
	var prompt database.AIPromptDB
	if err := c.ShouldBindJSON(&prompt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	prompt.IsActive = true
	prompt.Version = 1
	if err := database.GetDB().Create(&prompt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, prompt)
}

func UpdatePrompt(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var prompt database.AIPromptDB
	if err := database.GetDB().First(&prompt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prompt not found"})
		return
	}
	if err := c.ShouldBindJSON(&prompt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	prompt.ID = uint(id)
	if err := database.GetDB().Save(&prompt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prompt)
}

// GetPublicPrompts returns prompts as a map for frontend use (no auth required)
func GetPublicPrompts(c *gin.Context) {
	var prompts []database.AIPromptDB
	if err := database.GetDB().Where("is_active = ?", true).Find(&prompts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return as a map keyed by prompt key for easy frontend access
	result := make(map[string]string)
	for _, p := range prompts {
		result[p.Key] = p.Content
	}
	c.JSON(http.StatusOK, result)
}

// ============ Statistics ============

func GetStatsOverview(c *gin.Context) {
	db := database.GetDB()
	today := time.Now().Format("2006-01-02")

	var todayStats database.UsageStats
	db.Where("date = ?", today).FirstOrCreate(&todayStats, database.UsageStats{Date: today})

	weekAgo := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	var weekStats struct {
		QuizCompleted  int64
		ShareGenerated int64
		AIChatsStarted int64
		AIInsightUsed  int64
	}
	db.Model(&database.UsageStats{}).
		Where("date >= ?", weekAgo).
		Select("SUM(quiz_completed) as quiz_completed, SUM(share_generated) as share_generated, SUM(ai_chats_started) as ai_chats_started, SUM(ai_insight_used) as ai_insight_used").
		Scan(&weekStats)

	var totalStats struct {
		QuizCompleted  int64
		ShareGenerated int64
		AIChatsStarted int64
		AIInsightUsed  int64
	}
	db.Model(&database.UsageStats{}).
		Select("SUM(quiz_completed) as quiz_completed, SUM(share_generated) as share_generated, SUM(ai_chats_started) as ai_chats_started, SUM(ai_insight_used) as ai_insight_used").
		Scan(&totalStats)

	c.JSON(http.StatusOK, gin.H{
		"today": gin.H{
			"quizCompleted":  todayStats.QuizCompleted,
			"shareGenerated": todayStats.ShareGenerated,
			"aiChatsStarted": todayStats.AIChatsStarted,
			"aiInsightUsed":  todayStats.AIInsightUsed,
		},
		"week": gin.H{
			"quizCompleted":  weekStats.QuizCompleted,
			"shareGenerated": weekStats.ShareGenerated,
			"aiChatsStarted": weekStats.AIChatsStarted,
			"aiInsightUsed":  weekStats.AIInsightUsed,
		},
		"total": gin.H{
			"quizCompleted":  totalStats.QuizCompleted,
			"shareGenerated": totalStats.ShareGenerated,
			"aiChatsStarted": totalStats.AIChatsStarted,
			"aiInsightUsed":  totalStats.AIInsightUsed,
		},
	})
}

func GetDailyStats(c *gin.Context) {
	days := 30
	if d, err := strconv.Atoi(c.Query("days")); err == nil && d > 0 {
		days = d
	}

	startDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	var stats []database.UsageStats
	if err := database.GetDB().
		Where("date >= ?", startDate).
		Order("date asc").
		Find(&stats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func GetGlowtypeDistribution(c *gin.Context) {
	var distribution []struct {
		TypeCode string `json:"typeCode"`
		Count    int64  `json:"count"`
	}

	database.GetDB().Model(&database.GlowtypeStats{}).
		Select("type_code, SUM(count) as count").
		Group("type_code").
		Order("count desc").
		Scan(&distribution)

	c.JSON(http.StatusOK, distribution)
}

// ============ Quiz Results ============

func ListQuizResults(c *gin.Context) {
	limit := 100
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 1000 {
		limit = l
	}

	var results []database.QuizResultDB
	if err := database.GetDB().
		Order("created_at desc").
		Limit(limit).
		Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

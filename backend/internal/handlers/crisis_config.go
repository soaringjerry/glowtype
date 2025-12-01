package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/audit"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/services"
	"gorm.io/gorm"
)

// embeddingService is the global embedding service instance
var embeddingService *services.EmbeddingService

// InitEmbeddingService initializes the embedding service
func InitEmbeddingService(db *gorm.DB) {
	embeddingService = services.NewEmbeddingService(db)
}

// ============ Crisis Keywords ============

// ListCrisisKeywords returns all crisis keywords
func ListCrisisKeywords(c *gin.Context) {
	db := database.GetDB()

	var keywords []database.CrisisKeywordDB
	query := db.Order("level DESC, language, keyword")

	// Filter by level if provided
	if level := c.Query("level"); level != "" {
		query = query.Where("level = ?", level)
	}
	// Filter by language if provided
	if lang := c.Query("language"); lang != "" {
		query = query.Where("language = ?", lang)
	}
	// Filter by active status
	if active := c.Query("active"); active != "" {
		query = query.Where("is_active = ?", active == "true")
	}

	if err := query.Find(&keywords).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, keywords)
}

// CreateCrisisKeyword creates a new crisis keyword
func CreateCrisisKeyword(c *gin.Context) {
	db := database.GetDB()

	var keyword database.CrisisKeywordDB
	if err := c.ShouldBindJSON(&keyword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&keyword).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Increment config version for hot-reload
	incrementCrisisConfigVersion(db)

	c.JSON(http.StatusCreated, keyword)
}

// UpdateCrisisKeyword updates an existing crisis keyword
func UpdateCrisisKeyword(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var existing database.CrisisKeywordDB
	if err := db.First(&existing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyword not found"})
		return
	}

	// Record before state for audit diff
	audit.SetBeforeState(c, "crisis_keyword", existing.ID, existing)

	var keyword database.CrisisKeywordDB
	if err := c.ShouldBindJSON(&keyword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	keyword.ID = existing.ID

	if err := db.Save(&keyword).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state for audit diff
	audit.SetAfterState(c, keyword)

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, keyword)
}

// DeleteCrisisKeyword deletes a crisis keyword
func DeleteCrisisKeyword(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	// Record before state for audit diff (delete operation)
	var existing database.CrisisKeywordDB
	if err := db.First(&existing, id).Error; err == nil {
		audit.SetDeleteState(c, "crisis_keyword", existing.ID, existing)
	}

	if err := db.Delete(&database.CrisisKeywordDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// BulkCreateCrisisKeywords creates multiple keywords at once
func BulkCreateCrisisKeywords(c *gin.Context) {
	db := database.GetDB()

	var keywords []database.CrisisKeywordDB
	if err := c.ShouldBindJSON(&keywords); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&keywords).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusCreated, gin.H{"created": len(keywords)})
}

// ============ Crisis Exclude Patterns ============

// ListCrisisExcludePatterns returns all exclude patterns
func ListCrisisExcludePatterns(c *gin.Context) {
	db := database.GetDB()

	var patterns []database.CrisisExcludePatternDB
	if err := db.Order("language, pattern").Find(&patterns).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, patterns)
}

// CreateCrisisExcludePattern creates a new exclude pattern
func CreateCrisisExcludePattern(c *gin.Context) {
	db := database.GetDB()

	var pattern database.CrisisExcludePatternDB
	if err := c.ShouldBindJSON(&pattern); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&pattern).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusCreated, pattern)
}

// UpdateCrisisExcludePattern updates an existing exclude pattern
func UpdateCrisisExcludePattern(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var pattern database.CrisisExcludePatternDB
	if err := db.First(&pattern, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pattern not found"})
		return
	}

	if err := c.ShouldBindJSON(&pattern); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Save(&pattern).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, pattern)
}

// DeleteCrisisExcludePattern deletes an exclude pattern
func DeleteCrisisExcludePattern(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	if err := db.Delete(&database.CrisisExcludePatternDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ============ Crisis Resources ============

// ListCrisisResources returns all crisis resources
func ListCrisisResources(c *gin.Context) {
	db := database.GetDB()

	var resources []database.CrisisResourceDB
	query := db.Order("country, priority DESC, name")

	if country := c.Query("country"); country != "" {
		query = query.Where("country = ?", country)
	}

	if err := query.Find(&resources).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resources)
}

// CreateCrisisResource creates a new crisis resource
func CreateCrisisResource(c *gin.Context) {
	db := database.GetDB()

	var resource database.CrisisResourceDB
	if err := c.ShouldBindJSON(&resource); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&resource).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusCreated, resource)
}

// UpdateCrisisResource updates an existing crisis resource
func UpdateCrisisResource(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var resource database.CrisisResourceDB
	if err := db.First(&resource, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resource not found"})
		return
	}

	if err := c.ShouldBindJSON(&resource); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Save(&resource).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, resource)
}

// DeleteCrisisResource deletes a crisis resource
func DeleteCrisisResource(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	if err := db.Delete(&database.CrisisResourceDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ============ Crisis Forbidden Phrases ============

// ListCrisisForbiddenPhrases returns all forbidden phrases
func ListCrisisForbiddenPhrases(c *gin.Context) {
	db := database.GetDB()

	var phrases []database.CrisisForbiddenPhraseDB
	query := db.Order("language, phrase")

	if lang := c.Query("language"); lang != "" {
		query = query.Where("language = ?", lang)
	}

	if err := query.Find(&phrases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, phrases)
}

// CreateCrisisForbiddenPhrase creates a new forbidden phrase
func CreateCrisisForbiddenPhrase(c *gin.Context) {
	db := database.GetDB()

	var phrase database.CrisisForbiddenPhraseDB
	if err := c.ShouldBindJSON(&phrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&phrase).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusCreated, phrase)
}

// UpdateCrisisForbiddenPhrase updates an existing forbidden phrase
func UpdateCrisisForbiddenPhrase(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var phrase database.CrisisForbiddenPhraseDB
	if err := db.First(&phrase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Phrase not found"})
		return
	}

	if err := c.ShouldBindJSON(&phrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Save(&phrase).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, phrase)
}

// DeleteCrisisForbiddenPhrase deletes a forbidden phrase
func DeleteCrisisForbiddenPhrase(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	if err := db.Delete(&database.CrisisForbiddenPhraseDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ============ Crisis Glowtype Guidance ============

// ListCrisisGlowtypeGuidance returns all glowtype guidance
func ListCrisisGlowtypeGuidance(c *gin.Context) {
	db := database.GetDB()

	var guidance []database.CrisisGlowtypeGuidanceDB
	query := db.Order("glowtype_code, language, field_type, display_order")

	if code := c.Query("glowtypeCode"); code != "" {
		query = query.Where("glowtype_code = ?", code)
	}
	if lang := c.Query("language"); lang != "" {
		query = query.Where("language = ?", lang)
	}

	if err := query.Find(&guidance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, guidance)
}

// CreateCrisisGlowtypeGuidance creates a new glowtype guidance entry
func CreateCrisisGlowtypeGuidance(c *gin.Context) {
	db := database.GetDB()

	var guidance database.CrisisGlowtypeGuidanceDB
	if err := c.ShouldBindJSON(&guidance); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&guidance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusCreated, guidance)
}

// UpdateCrisisGlowtypeGuidance updates an existing glowtype guidance entry
func UpdateCrisisGlowtypeGuidance(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var guidance database.CrisisGlowtypeGuidanceDB
	if err := db.First(&guidance, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Guidance not found"})
		return
	}

	if err := c.ShouldBindJSON(&guidance); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Save(&guidance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, guidance)
}

// DeleteCrisisGlowtypeGuidance deletes a glowtype guidance entry
func DeleteCrisisGlowtypeGuidance(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	if err := db.Delete(&database.CrisisGlowtypeGuidanceDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ============ Crisis Settings ============

// GetCrisisSettings returns the crisis settings
func GetCrisisSettingsHandler(c *gin.Context) {
	db := database.GetDB()

	settings, err := database.GetCrisisSettings(db, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateCrisisSettings updates the crisis settings
func UpdateCrisisSettingsHandler(c *gin.Context) {
	db := database.GetDB()

	settings, err := database.GetCrisisSettings(db, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record before state for audit diff (copy current state)
	beforeState := *settings
	audit.SetBeforeState(c, "crisis_settings", settings.ID, beforeState)

	if err := c.ShouldBindJSON(settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Increment version for hot-reload
	settings.ConfigVersion++

	if err := db.Save(settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state for audit diff
	audit.SetAfterState(c, *settings)

	c.JSON(http.StatusOK, settings)
}

// GetCrisisConfigVersion returns the current config version for hot-reload checking
func GetCrisisConfigVersion(c *gin.Context) {
	db := database.GetDB()

	settings, err := database.GetCrisisSettings(db, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"version": settings.ConfigVersion})
}

// ============ Crisis Config Overview ============

// CrisisConfigOverview returns counts of all crisis config items
type CrisisConfigOverviewResponse struct {
	Keywords        int `json:"keywords"`
	ExcludePatterns int `json:"excludePatterns"`
	Resources       int `json:"resources"`
	ForbiddenPhrases int `json:"forbiddenPhrases"`
	GlowtypeGuidance int `json:"glowtypeGuidance"`
	ConfigVersion   int `json:"configVersion"`
}

// GetCrisisConfigOverview returns an overview of all crisis configuration
func GetCrisisConfigOverview(c *gin.Context) {
	db := database.GetDB()

	var keywordCount, patternCount, resourceCount, phraseCount, guidanceCount int64
	db.Model(&database.CrisisKeywordDB{}).Where("is_active = ?", true).Count(&keywordCount)
	db.Model(&database.CrisisExcludePatternDB{}).Where("is_active = ?", true).Count(&patternCount)
	db.Model(&database.CrisisResourceDB{}).Where("is_active = ?", true).Count(&resourceCount)
	db.Model(&database.CrisisForbiddenPhraseDB{}).Where("is_active = ?", true).Count(&phraseCount)
	db.Model(&database.CrisisGlowtypeGuidanceDB{}).Where("is_active = ?", true).Count(&guidanceCount)

	settings, _ := database.GetCrisisSettings(db, nil)
	version := 1
	if settings != nil {
		version = settings.ConfigVersion
	}

	c.JSON(http.StatusOK, CrisisConfigOverviewResponse{
		Keywords:        int(keywordCount),
		ExcludePatterns: int(patternCount),
		Resources:       int(resourceCount),
		ForbiddenPhrases: int(phraseCount),
		GlowtypeGuidance: int(guidanceCount),
		ConfigVersion:   version,
	})
}

// ============ Reset to Defaults ============

// ResetCrisisConfigHandler resets all crisis config to defaults from JSON files
// Note: crisis_admin role is NOT allowed to reset
func ResetCrisisConfigHandler(c *gin.Context) {
	// Block crisis_admin from resetting
	if isCrisisAdminRole(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Reset not allowed for crisis_admin role"})
		return
	}

	db := database.GetDB()

	// Get what to reset from query params
	resetKeywords := c.Query("keywords") == "true"
	resetPatterns := c.Query("patterns") == "true"
	resetResources := c.Query("resources") == "true"
	resetPhrases := c.Query("phrases") == "true"
	resetGuidance := c.Query("guidance") == "true"
	resetScripts := c.Query("scripts") == "true"
	resetAll := c.Query("all") == "true"

	if resetAll {
		resetKeywords = true
		resetPatterns = true
		resetResources = true
		resetPhrases = true
		resetGuidance = true
		resetScripts = true
	}

	results := make(map[string]interface{})

	if resetKeywords {
		db.Where("1=1").Delete(&database.CrisisKeywordDB{})
		count := database.SeedCrisisKeywords(db)
		results["keywords"] = count
	}
	if resetPatterns {
		db.Where("1=1").Delete(&database.CrisisExcludePatternDB{})
		count := database.SeedCrisisExcludePatterns(db)
		results["excludePatterns"] = count
	}
	if resetResources {
		db.Where("1=1").Delete(&database.CrisisResourceDB{})
		count := database.SeedCrisisResources(db)
		results["resources"] = count
	}
	if resetPhrases {
		db.Where("1=1").Delete(&database.CrisisForbiddenPhraseDB{})
		count := database.SeedCrisisForbiddenPhrases(db)
		results["forbiddenPhrases"] = count
	}
	if resetGuidance {
		db.Where("1=1").Delete(&database.CrisisGlowtypeGuidanceDB{})
		count := database.SeedCrisisGlowtypeGuidance(db)
		results["glowtypeGuidance"] = count
	}
	if resetScripts {
		db.Where("1=1").Delete(&database.CrisisScriptDB{})
		count := database.SeedCrisisScripts(db)
		results["scripts"] = count
	}

	incrementCrisisConfigVersion(db)

	// Record audit metadata for reset operation
	c.Set("auditMetadata", map[string]any{
		"operation":      "reset_to_defaults",
		"resourceType":   "crisis_config",
		"resetKeywords":  resetKeywords,
		"resetPatterns":  resetPatterns,
		"resetResources": resetResources,
		"resetPhrases":   resetPhrases,
		"resetGuidance":  resetGuidance,
		"resetScripts":   resetScripts,
		"results":        results,
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Reset complete",
		"results": results,
	})
}

// ============ Crisis Scripts (Expert-reviewed conversation scripts) ============

// ListCrisisScripts returns all crisis scripts
func ListCrisisScripts(c *gin.Context) {
	db := database.GetDB()

	var scripts []database.CrisisScriptDB
	query := db.Order("display_order, category, title")

	if mode := c.Query("mode"); mode != "" {
		query = query.Where("mode = ?", mode)
	}
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	if lang := c.Query("language"); lang != "" {
		query = query.Where("language = ?", lang)
	}
	if active := c.Query("active"); active != "" {
		query = query.Where("is_active = ?", active == "true")
	}

	if err := query.Find(&scripts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, scripts)
}

// CreateCrisisScript creates a new crisis script
func CreateCrisisScript(c *gin.Context) {
	db := database.GetDB()

	var script database.CrisisScriptDB
	if err := c.ShouldBindJSON(&script); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate mode
	if script.Mode != "template" && script.Mode != "reference" {
		script.Mode = "reference"
	}

	if err := db.Create(&script).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Async generate embedding for RAG
	if embeddingService != nil {
		go func(scriptID uint) {
			if err := embeddingService.UpdateScriptEmbedding(scriptID); err != nil {
				log.Printf("[CrisisScript] Failed to generate embedding for script %d: %v", scriptID, err)
			}
		}(script.ID)
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusCreated, script)
}

// UpdateCrisisScript updates an existing crisis script
func UpdateCrisisScript(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	var oldScript database.CrisisScriptDB
	if err := db.First(&oldScript, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Script not found"})
		return
	}

	// Store old content to check if it changed
	oldContent := oldScript.Content
	oldTitle := oldScript.Title

	var script database.CrisisScriptDB
	if err := c.ShouldBindJSON(&script); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Preserve ID
	script.ID = oldScript.ID

	// Validate mode
	if script.Mode != "template" && script.Mode != "reference" {
		script.Mode = "reference"
	}

	if err := db.Save(&script).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Regenerate embedding if content changed
	contentChanged := script.Content != oldContent || script.Title != oldTitle

	if contentChanged && embeddingService != nil {
		go func(scriptID uint) {
			if err := embeddingService.UpdateScriptEmbedding(scriptID); err != nil {
				log.Printf("[CrisisScript] Failed to update embedding for script %d: %v", scriptID, err)
			}
		}(script.ID)
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, script)
}

// DeleteCrisisScript deletes a crisis script
func DeleteCrisisScript(c *gin.Context) {
	db := database.GetDB()
	id := c.Param("id")

	if err := db.Delete(&database.CrisisScriptDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	incrementCrisisConfigVersion(db)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// RefreshScriptEmbeddings regenerates embeddings for all active scripts
func RefreshScriptEmbeddings(c *gin.Context) {
	if embeddingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Embedding service not initialized"})
		return
	}

	success, failed, err := embeddingService.RefreshAllEmbeddings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": success,
		"failed":  failed,
		"message": "Embeddings refreshed",
	})
}

// GetEmbeddingStats returns embedding statistics
func GetEmbeddingStats(c *gin.Context) {
	if embeddingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Embedding service not initialized"})
		return
	}

	total, withEmbedding, err := embeddingService.GetEmbeddingStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":         total,
		"withEmbedding": withEmbedding,
		"coverage":      float64(withEmbedding) / float64(total) * 100,
	})
}

// ============ Helper Functions ============

// isCrisisAdminRole checks if the user has crisis_admin role
func isCrisisAdminRole(c *gin.Context) bool {
	admin, ok := getAdminFromContext(c)
	if !ok {
		return false
	}
	return admin.Role == database.AdminRoleCrisis
}

func incrementCrisisConfigVersion(db *gorm.DB) {
	db.Model(&database.CrisisSettingsDB{}).
		Where("tenant_id IS NULL").
		UpdateColumn("config_version", gorm.Expr("config_version + 1"))
}

// parseUint is a helper to parse uint from string
func parseUint(s string) uint {
	id, _ := strconv.ParseUint(s, 10, 64)
	return uint(id)
}

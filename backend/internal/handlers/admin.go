package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/services"
	"gorm.io/gorm"
)

// AdminAuthMiddleware validates admin tokens and loads the user into context.
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		token := strings.TrimPrefix(header, "Bearer ")
		claims, err := services.ValidateAdminToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var user database.AdminUser
		if err := database.GetDB().Where("id = ? AND is_active = ?", claims.AdminID, true).First(&user).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Ensure role is present even if legacy data is missing it
		if user.Role == "" {
			user.Role = database.AdminRoleStandard
		}

		c.Set("adminUser", user)
		c.Next()
	}
}

// AdminAuditMiddleware records admin actions for accountability.
func AdminAuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		admin, ok := getAdminFromContext(c)
		if !ok {
			return
		}

		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		payload := map[string]any{
			"durationMs": time.Since(start).Milliseconds(),
			"status":     c.Writer.Status(),
		}
		if extra, ok := c.Get("auditMetadata"); ok {
			if meta, ok := extra.(map[string]any); ok {
				for k, v := range meta {
					payload[k] = v
				}
			}
		}

		metadata, _ := json.Marshal(payload)

		entry := database.AdminAuditLog{
			AdminID:    admin.ID,
			Username:   admin.Username,
			Action:     fmt.Sprintf("%s %s", c.Request.Method, path),
			Method:     c.Request.Method,
			Path:       path,
			IP:         c.ClientIP(),
			StatusCode: c.Writer.Status(),
			Metadata:   metadata,
		}

		if err := database.GetDB().Create(&entry).Error; err != nil {
			log.Printf("failed to write admin audit log: %v", err)
		}
	}
}

// RequireSuperAdmin blocks non-super-admin accounts from performing the action.
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		admin, ok := getAdminFromContext(c)
		if !ok || admin.Role != database.AdminRoleSuper {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			return
		}
		c.Next()
	}
}

// AdminLoginHandler handles admin login with username/password and rate limiting.
func AdminLoginHandler(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required"})
		return
	}

	clientIP := c.ClientIP()
	if !services.IsRateLimitDisabled() {
		locked, unlockAt, err := services.IsLoginLocked(database.GetDB(), req.Username, clientIP)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Login check failed"})
			return
		}
		if locked {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":    "Too many attempts. Please try again later.",
				"unlockAt": unlockAt,
			})
			return
		}
	}

	var user database.AdminUser
	if err := database.GetDB().Where("username = ?", req.Username).First(&user).Error; err != nil {
		_ = services.RegisterLoginFailure(database.GetDB(), req.Username, clientIP)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !user.IsActive {
		_ = services.RegisterLoginFailure(database.GetDB(), req.Username, clientIP)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !services.CheckPassword(user.PasswordHash, req.Password) {
		_ = services.RegisterLoginFailure(database.GetDB(), req.Username, clientIP)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, exp, err := services.GenerateAdminToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	now := time.Now()
	user.LastLoginAt = &now
	user.LastLoginIP = clientIP
	if err := database.GetDB().Model(&user).Updates(map[string]any{
		"last_login_at": now,
		"last_login_ip": clientIP,
	}).Error; err != nil {
		log.Printf("failed to update admin login metadata: %v", err)
	}

	_ = services.RegisterLoginSuccess(database.GetDB(), req.Username, clientIP)

	createAuditLog(user, "login", c, http.StatusOK, map[string]any{
		"userAgent": c.Request.UserAgent(),
	})

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"token":     token,
		"expiresAt": exp.Unix(),
		"user": gin.H{
			"id":          user.ID,
			"username":    user.Username,
			"role":        user.Role,
			"lastLoginAt": user.LastLoginAt,
			"lastLoginIp": user.LastLoginIP,
		},
	})
}

// GetAdminProfile returns the current admin's profile.
func GetAdminProfile(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          admin.ID,
		"username":    admin.Username,
		"role":        admin.Role,
		"lastLoginAt": admin.LastLoginAt,
		"lastLoginIp": admin.LastLoginIP,
		"createdAt":   admin.CreatedAt,
	})
}

// ListAdminUsers lists all admin accounts (super admin only).
func ListAdminUsers(c *gin.Context) {
	var admins []database.AdminUser
	if err := database.GetDB().Order("created_at desc").Find(&admins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Remove password hashes from response
	for i := range admins {
		admins[i].PasswordHash = ""
	}

	c.JSON(http.StatusOK, admins)
}

// CreateAdminUser creates a new admin account (super admin only).
func CreateAdminUser(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	role := req.Role
	if role == "" {
		role = database.AdminRoleStandard
	}
	if role != database.AdminRoleStandard && role != database.AdminRoleSuper {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	if strings.TrimSpace(req.Username) == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required"})
		return
	}

	hash, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	admin := database.AdminUser{
		Username:     strings.TrimSpace(req.Username),
		PasswordHash: hash,
		Role:         role,
		IsActive:     true,
	}

	if err := database.GetDB().Create(&admin).Error; err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || errors.Is(err, gorm.ErrDuplicatedKey) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Username already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Set("auditMetadata", map[string]any{
		"createdUser": admin.Username,
		"role":        admin.Role,
	})

	c.JSON(http.StatusCreated, gin.H{
		"id":        admin.ID,
		"username":  admin.Username,
		"role":      admin.Role,
		"createdAt": admin.CreatedAt,
	})
}

// ListAuditLogs returns recent admin audit logs (super admin only).
func ListAuditLogs(c *gin.Context) {
	limit := 200
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "200")); err == nil && l > 0 && l <= 1000 {
		limit = l
	}

	query := database.GetDB().Order("created_at desc").Limit(limit)
	if user := strings.TrimSpace(c.Query("username")); user != "" {
		query = query.Where("username = ?", user)
	}

	var logs []database.AdminAuditLog
	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, logs)
}

func getAdminFromContext(c *gin.Context) (database.AdminUser, bool) {
	adminVal, ok := c.Get("adminUser")
	if !ok {
		return database.AdminUser{}, false
	}
	admin, ok := adminVal.(database.AdminUser)
	return admin, ok
}

func createAuditLog(admin database.AdminUser, action string, c *gin.Context, status int, metadata map[string]any) {
	meta, _ := json.Marshal(metadata)
	path := c.FullPath()
	if path == "" {
		path = c.Request.URL.Path
	}

	entry := database.AdminAuditLog{
		AdminID:    admin.ID,
		Username:   admin.Username,
		Action:     action,
		Method:     c.Request.Method,
		Path:       path,
		IP:         c.ClientIP(),
		StatusCode: status,
		Metadata:   meta,
	}

	if err := database.GetDB().Create(&entry).Error; err != nil {
		log.Printf("failed to write audit log: %v", err)
	}
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

// GlowtypeMerged combines GlowtypeDB with I18N data for frontend convenience
type GlowtypeMerged struct {
	ID             uint   `json:"id"`
	TypeCode       string `json:"typeCode"`
	PrimaryColor   string `json:"primaryColor"`
	Gradient       string `json:"gradient"`
	CardAccent     string `json:"cardAccent"`
	TextColor      string `json:"textColor"`
	NameZh         string `json:"nameZh"`
	NameEn         string `json:"nameEn"`
	TaglineZh      string `json:"taglineZh"`
	TaglineEn      string `json:"taglineEn"`
	DescriptionZh  string `json:"descriptionZh"`
	DescriptionEn  string `json:"descriptionEn"`
	SelfCareTipsZh string `json:"selfCareTipsZh"`
	SelfCareTipsEn string `json:"selfCareTipsEn"`
	DisclaimerZh   string `json:"disclaimerZh"`
	DisclaimerEn   string `json:"disclaimerEn"`
}

func ListGlowtypes(c *gin.Context) {
	var glowtypes []database.GlowtypeDB
	if err := database.GetDB().Where("is_active = ?", true).Order("type_code asc").Find(&glowtypes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Merge with i18n data
	result := make([]GlowtypeMerged, 0, len(glowtypes))
	for _, gt := range glowtypes {
		merged := GlowtypeMerged{
			ID:           gt.ID,
			TypeCode:     gt.TypeCode,
			PrimaryColor: gt.PrimaryColor,
			Gradient:     gt.AuraGradient,
			CardAccent:   gt.CardAccent,
			TextColor:    gt.TextColor,
		}

		// Load i18n records
		var i18ns []database.GlowtypeI18NDB
		database.GetDB().Where("glowtype_id = ?", gt.ID).Find(&i18ns)
		for _, i18n := range i18ns {
			switch i18n.Lang {
			case "zh":
				merged.NameZh = i18n.Name
				merged.TaglineZh = i18n.Tagline
				merged.DescriptionZh = i18n.Description
				merged.SelfCareTipsZh = i18n.SelfCareTips
				merged.DisclaimerZh = i18n.Disclaimer
			case "en":
				merged.NameEn = i18n.Name
				merged.TaglineEn = i18n.Tagline
				merged.DescriptionEn = i18n.Description
				merged.SelfCareTipsEn = i18n.SelfCareTips
				merged.DisclaimerEn = i18n.Disclaimer
			}
		}
		result = append(result, merged)
	}
	c.JSON(http.StatusOK, result)
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
	var input GlowtypeMerged
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create main glowtype record
	glowtype := database.GlowtypeDB{
		TypeCode:     input.TypeCode,
		PrimaryColor: input.PrimaryColor,
		AuraGradient: input.Gradient,
		CardAccent:   input.CardAccent,
		TextColor:    input.TextColor,
		IsActive:     true,
		Version:      1,
	}
	if err := database.GetDB().Create(&glowtype).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create i18n records
	if input.NameZh != "" || input.TaglineZh != "" || input.DescriptionZh != "" {
		zhI18n := database.GlowtypeI18NDB{
			GlowtypeID:   glowtype.ID,
			Lang:         "zh",
			Name:         input.NameZh,
			Tagline:      input.TaglineZh,
			Description:  input.DescriptionZh,
			SelfCareTips: input.SelfCareTipsZh,
			Disclaimer:   input.DisclaimerZh,
		}
		database.GetDB().Create(&zhI18n)
	}
	if input.NameEn != "" || input.TaglineEn != "" || input.DescriptionEn != "" {
		enI18n := database.GlowtypeI18NDB{
			GlowtypeID:   glowtype.ID,
			Lang:         "en",
			Name:         input.NameEn,
			Tagline:      input.TaglineEn,
			Description:  input.DescriptionEn,
			SelfCareTips: input.SelfCareTipsEn,
			Disclaimer:   input.DisclaimerEn,
		}
		database.GetDB().Create(&enI18n)
	}

	// Return merged result
	input.ID = glowtype.ID
	c.JSON(http.StatusCreated, input)
}

func UpdateGlowtype(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var glowtype database.GlowtypeDB
	if err := database.GetDB().First(&glowtype, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Glowtype not found"})
		return
	}

	var input GlowtypeMerged
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update main glowtype record
	glowtype.TypeCode = input.TypeCode
	glowtype.PrimaryColor = input.PrimaryColor
	glowtype.AuraGradient = input.Gradient
	glowtype.CardAccent = input.CardAccent
	glowtype.TextColor = input.TextColor
	if err := database.GetDB().Save(&glowtype).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update or create i18n records
	db := database.GetDB()

	// Chinese i18n
	var zhI18n database.GlowtypeI18NDB
	if err := db.Where("glowtype_id = ? AND lang = ?", id, "zh").First(&zhI18n).Error; err != nil {
		// Create new
		zhI18n = database.GlowtypeI18NDB{GlowtypeID: uint(id), Lang: "zh"}
	}
	zhI18n.Name = input.NameZh
	zhI18n.Tagline = input.TaglineZh
	zhI18n.Description = input.DescriptionZh
	zhI18n.SelfCareTips = input.SelfCareTipsZh
	zhI18n.Disclaimer = input.DisclaimerZh
	db.Save(&zhI18n)

	// English i18n
	var enI18n database.GlowtypeI18NDB
	if err := db.Where("glowtype_id = ? AND lang = ?", id, "en").First(&enI18n).Error; err != nil {
		// Create new
		enI18n = database.GlowtypeI18NDB{GlowtypeID: uint(id), Lang: "en"}
	}
	enI18n.Name = input.NameEn
	enI18n.Tagline = input.TaglineEn
	enI18n.Description = input.DescriptionEn
	enI18n.SelfCareTips = input.SelfCareTipsEn
	enI18n.Disclaimer = input.DisclaimerEn
	db.Save(&enI18n)

	// Return merged result
	input.ID = uint(id)
	c.JSON(http.StatusOK, input)
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

// PromptSlot represents a prompt slot with its current value and default
type PromptSlot struct {
	Key            string `json:"key"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	DefaultContent string `json:"defaultContent"`
	CurrentContent string `json:"currentContent"`
	IsCustomized   bool   `json:"isCustomized"`
	IsActive       bool   `json:"isActive"`
	ID             uint   `json:"id,omitempty"`
}

// ListPrompts returns all prompt slots with their current values and defaults
func ListPrompts(c *gin.Context) {
	// Get all prompts from database
	var dbPrompts []database.AIPromptDB
	if err := database.GetDB().Order("key asc").Find(&dbPrompts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create a map for quick lookup
	promptMap := make(map[string]database.AIPromptDB)
	for _, p := range dbPrompts {
		promptMap[p.Key] = p
	}

	// Build response with all default slots
	var slots []PromptSlot
	for _, def := range database.DefaultPrompts {
		slot := PromptSlot{
			Key:            def.Key,
			Name:           def.Name,
			Description:    def.Description,
			DefaultContent: def.Content,
			CurrentContent: def.Content,
			IsCustomized:   false,
			IsActive:       true,
		}

		// Check if there's a customized version in DB
		if dbPrompt, exists := promptMap[def.Key]; exists {
			slot.ID = dbPrompt.ID
			slot.CurrentContent = dbPrompt.Content
			slot.IsActive = dbPrompt.IsActive
			slot.IsCustomized = dbPrompt.Content != def.Content
			// Use DB name/description if set
			if dbPrompt.Name != "" {
				slot.Name = dbPrompt.Name
			}
			if dbPrompt.Description != "" {
				slot.Description = dbPrompt.Description
			}
		}

		slots = append(slots, slot)
	}

	c.JSON(http.StatusOK, slots)
}

// CreatePrompt is deprecated - prompts are auto-created from defaults
// Kept for API compatibility but should not be used
func CreatePrompt(c *gin.Context) {
	c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot create new prompt slots. Use PUT to update existing prompts."})
}

// UpdatePrompt updates the content of an existing prompt by key
func UpdatePrompt(c *gin.Context) {
	key := c.Param("id") // Can be either ID or key

	var prompt database.AIPromptDB

	// Try to find by ID first (for backwards compatibility)
	if id, err := strconv.Atoi(key); err == nil {
		if err := database.GetDB().First(&prompt, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Prompt not found"})
			return
		}
	} else {
		// Find by key
		if err := database.GetDB().Where("key = ?", key).First(&prompt).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Prompt not found"})
			return
		}
	}

	// Parse update request
	var req struct {
		Content  string `json:"content"`
		IsActive *bool  `json:"isActive,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	prompt.Content = req.Content
	if req.IsActive != nil {
		prompt.IsActive = *req.IsActive
	}
	prompt.Version++

	if err := database.GetDB().Save(&prompt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prompt)
}

// ResetPrompt resets a prompt to its default content
func ResetPrompt(c *gin.Context) {
	key := c.Param("key")

	// Find the default
	var defaultPrompt *database.AIPromptDB
	for _, def := range database.DefaultPrompts {
		if def.Key == key {
			defaultPrompt = &def
			break
		}
	}
	if defaultPrompt == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Unknown prompt key"})
		return
	}

	// Update DB prompt to default content
	var prompt database.AIPromptDB
	if err := database.GetDB().Where("key = ?", key).First(&prompt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prompt not found in database"})
		return
	}

	prompt.Content = defaultPrompt.Content
	prompt.IsActive = true
	prompt.Version++

	if err := database.GetDB().Save(&prompt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Prompt reset to default"})
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

// ============ Glowpedia (光签) ============

// ListChapters returns all book chapters
func ListChapters(c *gin.Context) {
	var chapters []database.BookChapterDB
	if err := database.GetDB().Order("\"order\" asc").Find(&chapters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, chapters)
}

// CreateChapter creates a new chapter
func CreateChapter(c *gin.Context) {
	var input database.BookChapterDB
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.IsActive = true
	if err := database.GetDB().Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, input)
}

// UpdateChapter updates a chapter
func UpdateChapter(c *gin.Context) {
	id := c.Param("id")
	var chapter database.BookChapterDB
	if err := database.GetDB().First(&chapter, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chapter not found"})
		return
	}
	var input database.BookChapterDB
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	chapter.ChapterID = input.ChapterID
	chapter.NameZH = input.NameZH
	chapter.NameEN = input.NameEN
	chapter.DescZH = input.DescZH
	chapter.DescEN = input.DescEN
	chapter.Icon = input.Icon
	chapter.Color = input.Color
	chapter.Order = input.Order
	chapter.IsActive = input.IsActive
	if err := database.GetDB().Save(&chapter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, chapter)
}

// DeleteChapter deletes a chapter
func DeleteChapter(c *gin.Context) {
	id := c.Param("id")
	if err := database.GetDB().Delete(&database.BookChapterDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListGlowSticks returns all glow sticks
func ListGlowSticks(c *gin.Context) {
	var sticks []database.GlowStickDB
	if err := database.GetDB().Order("\"order\" asc").Find(&sticks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sticks)
}

// CreateGlowStick creates a new glow stick
func CreateGlowStick(c *gin.Context) {
	var input database.GlowStickDB
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.IsActive = true
	if err := database.GetDB().Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, input)
}

// UpdateGlowStick updates a glow stick
func UpdateGlowStick(c *gin.Context) {
	id := c.Param("id")
	var stick database.GlowStickDB
	if err := database.GetDB().First(&stick, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Glow stick not found"})
		return
	}
	var input database.GlowStickDB
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	stick.TitleZH = input.TitleZH
	stick.TitleEN = input.TitleEN
	stick.MessageZH = input.MessageZH
	stick.MessageEN = input.MessageEN
	stick.Color = input.Color
	stick.ChapterID = input.ChapterID
	stick.ForTypes = input.ForTypes
	stick.Order = input.Order
	stick.IsActive = input.IsActive
	if err := database.GetDB().Save(&stick).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stick)
}

// DeleteGlowStick deletes a glow stick
func DeleteGlowStick(c *gin.Context) {
	id := c.Param("id")
	if err := database.GetDB().Delete(&database.GlowStickDB{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============ Bulk Import/Export ============

// ImportMode defines how to handle existing data during import
type ImportMode string

const (
	ImportModeMerge   ImportMode = "merge"   // Upsert: update existing, create new
	ImportModeReplace ImportMode = "replace" // Clear all and import fresh
)

// ImportResult contains the result of an import operation
type ImportResult struct {
	Success  bool              `json:"success"`
	Mode     ImportMode        `json:"mode"`
	Total    int               `json:"total"`
	Created  int               `json:"created"`
	Updated  int               `json:"updated"`
	Skipped  int               `json:"skipped"`
	Errors   []ImportError     `json:"errors,omitempty"`
	Warnings []string          `json:"warnings,omitempty"`
}

// ImportError describes an error for a specific item
type ImportError struct {
	Index   int    `json:"index"`
	ID      string `json:"id,omitempty"`
	Message string `json:"message"`
}

// QuestionImportItem represents a question in import format
type QuestionImportItem struct {
	QuestionID         string             `json:"questionId"`
	Order              int                `json:"order"`
	QuestionZH         string             `json:"questionZh"`
	QuestionEN         string             `json:"questionEn"`
	Options            []database.OptionConfig `json:"options"`
	PrimaryDimensionID *uint              `json:"primaryDimensionId,omitempty"`
}

// ImportQuestions handles bulk question import with validation
func ImportQuestions(c *gin.Context) {
	var req struct {
		Mode  ImportMode           `json:"mode"`
		Items []QuestionImportItem `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// Default to merge mode
	if req.Mode == "" {
		req.Mode = ImportModeMerge
	}

	// Validate mode
	if req.Mode != ImportModeMerge && req.Mode != ImportModeReplace {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mode. Use 'merge' or 'replace'"})
		return
	}

	// Validate items array
	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No items to import"})
		return
	}

	// Limit import size to prevent abuse
	if len(req.Items) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Too many items. Maximum 500 questions per import"})
		return
	}

	// Get valid dimension keys for validation
	var dimensions []database.TraitDimensionDB
	database.GetDB().Find(&dimensions)
	validDimKeys := make(map[string]bool)
	for _, d := range dimensions {
		validDimKeys[d.Key] = true
	}

	// Validate all items first
	result := ImportResult{
		Mode:  req.Mode,
		Total: len(req.Items),
	}

	seenIDs := make(map[string]int) // Track duplicate questionIds within import
	for i, item := range req.Items {
		errors := validateQuestionItem(item, i, validDimKeys)

		// Check for duplicate questionId within import
		if prev, exists := seenIDs[item.QuestionID]; exists {
			errors = append(errors, ImportError{
				Index:   i,
				ID:      item.QuestionID,
				Message: fmt.Sprintf("Duplicate questionId '%s' (first seen at index %d)", item.QuestionID, prev),
			})
		}
		seenIDs[item.QuestionID] = i

		result.Errors = append(result.Errors, errors...)
	}

	// If there are validation errors, return without importing
	if len(result.Errors) > 0 {
		result.Success = false
		c.JSON(http.StatusBadRequest, result)
		return
	}

	db := database.GetDB()

	// For replace mode, use transaction to clear and import
	if req.Mode == ImportModeReplace {
		tx := db.Begin()

		// Soft delete all existing questions
		if err := tx.Model(&database.QuizQuestionDB{}).Where("1=1").Update("is_active", false).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing questions: " + err.Error()})
			return
		}

		// Hard delete for clean replace
		if err := tx.Unscoped().Where("1=1").Delete(&database.QuizQuestionDB{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete existing questions: " + err.Error()})
			return
		}

		// Import all items
		for _, item := range req.Items {
			optionsJSON, _ := json.Marshal(item.Options)
			q := database.QuizQuestionDB{
				QuestionID:         item.QuestionID,
				Order:              item.Order,
				QuestionZH:         item.QuestionZH,
				QuestionEN:         item.QuestionEN,
				Options:            optionsJSON,
				PrimaryDimensionID: item.PrimaryDimensionID,
				IsActive:           true,
				Version:            1,
			}
			if err := tx.Create(&q).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create question '%s': %s", item.QuestionID, err.Error())})
				return
			}
			result.Created++
		}

		tx.Commit()
	} else {
		// Merge mode: upsert each item
		for _, item := range req.Items {
			var existing database.QuizQuestionDB
			err := db.Where("question_id = ?", item.QuestionID).First(&existing).Error

			optionsJSON, _ := json.Marshal(item.Options)

			if errors.Is(err, gorm.ErrRecordNotFound) {
				// Create new
				q := database.QuizQuestionDB{
					QuestionID:         item.QuestionID,
					Order:              item.Order,
					QuestionZH:         item.QuestionZH,
					QuestionEN:         item.QuestionEN,
					Options:            optionsJSON,
					PrimaryDimensionID: item.PrimaryDimensionID,
					IsActive:           true,
					Version:            1,
				}
				if err := db.Create(&q).Error; err != nil {
					result.Errors = append(result.Errors, ImportError{
						ID:      item.QuestionID,
						Message: "Failed to create: " + err.Error(),
					})
					result.Skipped++
					continue
				}
				result.Created++
			} else if err != nil {
				result.Errors = append(result.Errors, ImportError{
					ID:      item.QuestionID,
					Message: "Database error: " + err.Error(),
				})
				result.Skipped++
			} else {
				// Update existing
				existing.Order = item.Order
				existing.QuestionZH = item.QuestionZH
				existing.QuestionEN = item.QuestionEN
				existing.Options = optionsJSON
				existing.PrimaryDimensionID = item.PrimaryDimensionID
				existing.IsActive = true
				existing.Version++
				if err := db.Save(&existing).Error; err != nil {
					result.Errors = append(result.Errors, ImportError{
						ID:      item.QuestionID,
						Message: "Failed to update: " + err.Error(),
					})
					result.Skipped++
					continue
				}
				result.Updated++
			}
		}
	}

	result.Success = len(result.Errors) == 0

	c.Set("auditMetadata", map[string]any{
		"importMode": req.Mode,
		"total":      result.Total,
		"created":    result.Created,
		"updated":    result.Updated,
	})

	c.JSON(http.StatusOK, result)
}

// validateQuestionItem validates a single question import item
func validateQuestionItem(item QuestionImportItem, index int, validDimKeys map[string]bool) []ImportError {
	var errors []ImportError

	// Required: questionId
	if strings.TrimSpace(item.QuestionID) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			Message: "questionId is required",
		})
	} else if len(item.QuestionID) > 50 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.QuestionID,
			Message: "questionId too long (max 50 characters)",
		})
	}

	// Required: at least one question text
	if strings.TrimSpace(item.QuestionZH) == "" && strings.TrimSpace(item.QuestionEN) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.QuestionID,
			Message: "At least one of questionZh or questionEn is required",
		})
	}

	// Required: at least 2 options
	if len(item.Options) < 2 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.QuestionID,
			Message: "At least 2 options are required",
		})
	}

	// Validate each option
	for optIdx, opt := range item.Options {
		// Option must have at least one text
		if strings.TrimSpace(opt.Text["zh"]) == "" && strings.TrimSpace(opt.Text["en"]) == "" {
			errors = append(errors, ImportError{
				Index:   index,
				ID:      item.QuestionID,
				Message: fmt.Sprintf("Option %d: at least one text (zh or en) is required", optIdx+1),
			})
		}

		// Validate dimension keys in scores
		for dimKey := range opt.Scores {
			if !validDimKeys[dimKey] {
				errors = append(errors, ImportError{
					Index:   index,
					ID:      item.QuestionID,
					Message: fmt.Sprintf("Option %d: unknown dimension key '%s'", optIdx+1, dimKey),
				})
			}
		}
	}

	// Validate order is reasonable
	if item.Order < 0 || item.Order > 10000 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.QuestionID,
			Message: "Order must be between 0 and 10000",
		})
	}

	return errors
}

// RuleImportItem represents a scoring rule in import format
type RuleImportItem struct {
	Name           string                    `json:"name"`
	Description    string                    `json:"description,omitempty"`
	Conditions     database.RuleConditions   `json:"conditions"`
	ResultTypeCode string                    `json:"resultTypeCode"`
	Priority       int                       `json:"priority"`
	IsFallback     bool                      `json:"isFallback"`
}

// ImportRules handles bulk scoring rules import with validation
func ImportRules(c *gin.Context) {
	var req struct {
		Mode  ImportMode       `json:"mode"`
		Items []RuleImportItem `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// Default to merge mode
	if req.Mode == "" {
		req.Mode = ImportModeMerge
	}

	// Validate mode
	if req.Mode != ImportModeMerge && req.Mode != ImportModeReplace {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mode. Use 'merge' or 'replace'"})
		return
	}

	// Validate items array
	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No items to import"})
		return
	}

	// Limit import size
	if len(req.Items) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Too many items. Maximum 200 rules per import"})
		return
	}

	// Get valid dimension keys and glowtype codes for validation
	var dimensions []database.TraitDimensionDB
	database.GetDB().Find(&dimensions)
	validDimKeys := make(map[string]bool)
	for _, d := range dimensions {
		validDimKeys[d.Key] = true
	}

	var glowtypes []database.GlowtypeDB
	database.GetDB().Where("is_active = ?", true).Find(&glowtypes)
	validTypeCodes := make(map[string]bool)
	for _, g := range glowtypes {
		validTypeCodes[g.TypeCode] = true
	}

	// Validate all items first
	result := ImportResult{
		Mode:  req.Mode,
		Total: len(req.Items),
	}

	seenNames := make(map[string]int)
	fallbackCount := 0
	for i, item := range req.Items {
		errors := validateRuleItem(item, i, validDimKeys, validTypeCodes)

		// Check for duplicate names within import
		if prev, exists := seenNames[item.Name]; exists {
			errors = append(errors, ImportError{
				Index:   i,
				ID:      item.Name,
				Message: fmt.Sprintf("Duplicate rule name '%s' (first seen at index %d)", item.Name, prev),
			})
		}
		seenNames[item.Name] = i

		if item.IsFallback {
			fallbackCount++
		}

		result.Errors = append(result.Errors, errors...)
	}

	// Warn if multiple fallbacks
	if fallbackCount > 1 {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Multiple fallback rules detected (%d). Only one should be marked as fallback.", fallbackCount))
	}

	// If there are validation errors, return without importing
	if len(result.Errors) > 0 {
		result.Success = false
		c.JSON(http.StatusBadRequest, result)
		return
	}

	db := database.GetDB()

	// For replace mode, use transaction
	if req.Mode == ImportModeReplace {
		tx := db.Begin()

		// Hard delete all existing rules
		if err := tx.Unscoped().Where("1=1").Delete(&database.ScoringRuleDB{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete existing rules: " + err.Error()})
			return
		}

		// Import all items
		for _, item := range req.Items {
			conditionsJSON, _ := json.Marshal(item.Conditions)
			rule := database.ScoringRuleDB{
				Name:           item.Name,
				Description:    item.Description,
				Conditions:     conditionsJSON,
				ResultTypeCode: item.ResultTypeCode,
				Priority:       item.Priority,
				IsFallback:     item.IsFallback,
				IsActive:       true,
				Version:        1,
			}
			if err := tx.Create(&rule).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create rule '%s': %s", item.Name, err.Error())})
				return
			}
			result.Created++
		}

		tx.Commit()
	} else {
		// Merge mode: upsert by name
		for _, item := range req.Items {
			var existing database.ScoringRuleDB
			err := db.Where("name = ?", item.Name).First(&existing).Error

			conditionsJSON, _ := json.Marshal(item.Conditions)

			if errors.Is(err, gorm.ErrRecordNotFound) {
				// Create new
				rule := database.ScoringRuleDB{
					Name:           item.Name,
					Description:    item.Description,
					Conditions:     conditionsJSON,
					ResultTypeCode: item.ResultTypeCode,
					Priority:       item.Priority,
					IsFallback:     item.IsFallback,
					IsActive:       true,
					Version:        1,
				}
				if err := db.Create(&rule).Error; err != nil {
					result.Errors = append(result.Errors, ImportError{
						ID:      item.Name,
						Message: "Failed to create: " + err.Error(),
					})
					result.Skipped++
					continue
				}
				result.Created++
			} else if err != nil {
				result.Errors = append(result.Errors, ImportError{
					ID:      item.Name,
					Message: "Database error: " + err.Error(),
				})
				result.Skipped++
			} else {
				// Update existing
				existing.Description = item.Description
				existing.Conditions = conditionsJSON
				existing.ResultTypeCode = item.ResultTypeCode
				existing.Priority = item.Priority
				existing.IsFallback = item.IsFallback
				existing.IsActive = true
				existing.Version++
				if err := db.Save(&existing).Error; err != nil {
					result.Errors = append(result.Errors, ImportError{
						ID:      item.Name,
						Message: "Failed to update: " + err.Error(),
					})
					result.Skipped++
					continue
				}
				result.Updated++
			}
		}
	}

	result.Success = len(result.Errors) == 0

	c.Set("auditMetadata", map[string]any{
		"importMode": req.Mode,
		"total":      result.Total,
		"created":    result.Created,
		"updated":    result.Updated,
	})

	c.JSON(http.StatusOK, result)
}

// validateRuleItem validates a single rule import item
func validateRuleItem(item RuleImportItem, index int, validDimKeys, validTypeCodes map[string]bool) []ImportError {
	var errors []ImportError

	// Required: name
	if strings.TrimSpace(item.Name) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			Message: "name is required",
		})
	} else if len(item.Name) > 100 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Name,
			Message: "name too long (max 100 characters)",
		})
	}

	// Required: resultTypeCode
	if strings.TrimSpace(item.ResultTypeCode) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Name,
			Message: "resultTypeCode is required",
		})
	} else if !validTypeCodes[item.ResultTypeCode] {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Name,
			Message: fmt.Sprintf("Unknown glowtype code '%s'", item.ResultTypeCode),
		})
	}

	// Validate dimension keys in conditions
	for dimKey := range item.Conditions.Dimensions {
		if !validDimKeys[dimKey] {
			errors = append(errors, ImportError{
				Index:   index,
				ID:      item.Name,
				Message: fmt.Sprintf("Unknown dimension key '%s' in conditions", dimKey),
			})
		}
	}

	// Validate priority range
	if item.Priority < -1000 || item.Priority > 1000 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Name,
			Message: "Priority must be between -1000 and 1000",
		})
	}

	return errors
}

// ExportRules exports all active scoring rules in import-compatible format
func ExportRules(c *gin.Context) {
	var rules []database.ScoringRuleDB
	if err := database.GetDB().Where("is_active = ?", true).Order("priority desc").Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert to export format
	items := make([]RuleImportItem, 0, len(rules))
	for _, r := range rules {
		var conditions database.RuleConditions
		if err := json.Unmarshal(r.Conditions, &conditions); err != nil {
			// Use empty conditions if parsing fails
			conditions = database.RuleConditions{Dimensions: map[string]database.DimensionCondition{}}
		}

		items = append(items, RuleImportItem{
			Name:           r.Name,
			Description:    r.Description,
			Conditions:     conditions,
			ResultTypeCode: r.ResultTypeCode,
			Priority:       r.Priority,
			IsFallback:     r.IsFallback,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"count": len(items),
	})
}

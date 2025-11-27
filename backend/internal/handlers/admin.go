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

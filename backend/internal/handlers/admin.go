package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/audit"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/services"
	"gorm.io/gorm"
)

const (
	maxAuditBodyBytes     = 8 * 1024
	maxAuditResponseBytes = 4 * 1024
	maxAuditString        = 1024
	// Stop reading bodies that are clearly oversized for audit logging to avoid memory churn.
	maxAuditCaptureBytes = 2 * 1024 * 1024
)

type Permission string

const (
	PermManageAdmins Permission = "admin.manage"
	PermAuditView    Permission = "audit.view"
	PermDimensions   Permission = "dimensions.write"
	PermQuestions    Permission = "questions.write"
	PermRules        Permission = "rules.write"
	PermGlowtypes    Permission = "glowtypes.write"
	PermPrompts      Permission = "prompts.write"
	PermContent      Permission = "content.write"
	PermStatsView    Permission = "stats.view"
	PermResultsView  Permission = "results.view"
	PermResetData    Permission = "data.reset"
	PermCrisisManage Permission = "crisis.manage"
)

// AllPermissions lists all available permissions for UI/validation
var AllPermissions = []Permission{
	PermManageAdmins,
	PermAuditView,
	PermDimensions,
	PermQuestions,
	PermRules,
	PermGlowtypes,
	PermPrompts,
	PermContent,
	PermStatsView,
	PermResultsView,
	PermResetData,
	PermCrisisManage,
}

// RolePermissionTemplates defines default permissions for each role (used as templates)
var RolePermissionTemplates = map[string]map[Permission]struct{}{
	database.AdminRoleSuper: permissionSet(AllPermissions...), // superadmin has all
	database.AdminRoleStandard: permissionSet(
		PermDimensions,
		PermQuestions,
		PermRules,
		PermGlowtypes,
		PermPrompts,
		PermContent,
		PermStatsView,
		PermResultsView,
	),
	database.AdminRoleContent: permissionSet(
		PermContent,
		PermStatsView,
	),
	database.AdminRoleData: permissionSet(
		PermDimensions,
		PermQuestions,
		PermRules,
		PermGlowtypes,
		PermPrompts,
		PermStatsView,
		PermResultsView,
	),
	database.AdminRoleAnalyst: permissionSet(
		PermStatsView,
		PermResultsView,
		PermAuditView,
	),
	// Crisis Admin: can manage all crisis config but NO import/export/reset
	database.AdminRoleCrisis: permissionSet(
		PermCrisisManage,
		PermPrompts,
		PermStatsView,
	),
	// Viewer: read-only access to most areas (NO admin.manage, NO audit.view)
	database.AdminRoleViewer: permissionSet(
		PermDimensions,
		PermQuestions,
		PermRules,
		PermGlowtypes,
		PermPrompts,
		PermContent,
		PermStatsView,
		PermResultsView,
	),
}

func permissionSet(perms ...Permission) map[Permission]struct{} {
	set := make(map[Permission]struct{}, len(perms))
	for _, p := range perms {
		set[p] = struct{}{}
	}
	return set
}

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
		if user.TokenVersion <= 0 {
			user.TokenVersion = 1
		}

		if claims.Version != user.TokenVersion {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		c.Set("adminUser", user)
		c.Next()
	}
}

// Require2FACompletionMiddleware blocks access to most admin endpoints until 2FA is enabled when required.
func Require2FACompletionMiddleware() gin.HandlerFunc {
	allowedPaths := map[string]struct{}{
		"/api/v1/admin/me":                      {},
		"/api/v1/admin/permissions/templates":   {},
		"/api/v1/admin/2fa/status":              {},
		"/api/v1/admin/2fa/setup":               {},
		"/api/v1/admin/2fa/verify":              {},
		"/api/v1/admin/2fa/recovery/regenerate": {},
	}

	return func(c *gin.Context) {
		admin, ok := getAdminFromContext(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		forced := admin.TwoFactorRequired || services.IsForceAdmin2FAEnabled()
		if !forced || admin.TwoFactorEnabled {
			c.Next()
			return
		}

		if _, ok := allowedPaths[c.FullPath()]; ok {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":         "Two-factor authentication setup required",
			"needs2FASetup": true,
		})
	}
}

// AdminAuditMiddleware records admin actions for accountability.
// Enhanced with: risk level classification, before/after diff, and integrity hash.
func AdminAuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		reqSnapshot := captureAuditRequest(c)

		recorder := newAuditResponseRecorder(c.Writer, maxAuditResponseBytes)
		c.Writer = recorder

		c.Next()

		admin, ok := getAdminFromContext(c)
		if !ok {
			return
		}

		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		sensitiveAISettings := strings.Contains(path, "/ai/settings")

		payload := map[string]any{
			"durationMs":  time.Since(start).Milliseconds(),
			"status":      c.Writer.Status(),
			"adminRole":   admin.Role,
			"ip":          c.ClientIP(),
			"userAgent":   c.Request.UserAgent(),
			"requestedAt": start.UTC().Format(time.RFC3339Nano),
		}

		if len(reqSnapshot.PathParams) > 0 {
			payload["pathParams"] = reqSnapshot.PathParams
		}
		if len(reqSnapshot.Query) > 0 {
			payload["query"] = reqSnapshot.Query
		}
		if sensitiveAISettings {
			payload["requestBody"] = "[redacted]"
		} else if reqSnapshot.Body != nil {
			payload["requestBody"] = reqSnapshot.Body
		}
		if reqSnapshot.BodyTruncated {
			payload["requestBodyTruncated"] = true
		}

		if sensitiveAISettings {
			payload["responseSample"] = "[redacted]"
		} else if sample := recorder.Sample(); sample != "" {
			payload["responseSample"] = sample
			if recorder.Truncated() {
				payload["responseSampleTruncated"] = true
			}
		}
		if extra, ok := c.Get("auditMetadata"); ok {
			if meta, ok := extra.(map[string]any); ok {
				for k, v := range meta {
					if _, exists := payload[k]; exists {
						continue
					}
					payload[k] = v
				}
			}
		}

		metadata, _ := json.Marshal(payload)

		// Determine risk level based on method and path
		riskLevel := audit.DetermineRiskLevel(c.Request.Method, path)

		// Extract diff data only for write operations
		var dataDiff []byte
		var resourceType string
		var resourceID *uint

		if audit.IsWriteMethod(c.Request.Method) {
			if diff := audit.ExtractDiff(c); diff != nil {
				if len(diff.Fields) > 0 {
					dataDiff, _ = json.Marshal(diff.Fields)
				}
				resourceType = diff.ResourceType
				if diff.ResourceID > 0 {
					rid := diff.ResourceID
					resourceID = &rid
				}
			}
		}

		// Set CreatedAt explicitly for hash calculation
		createdAt := time.Now().UTC()

		entry := database.AdminAuditLog{
			AdminID:      admin.ID,
			Username:     admin.Username,
			Action:       fmt.Sprintf("%s %s", c.Request.Method, path),
			Method:       c.Request.Method,
			Path:         path,
			IP:           c.ClientIP(),
			StatusCode:   c.Writer.Status(),
			Metadata:     metadata,
			CreatedAt:    createdAt,
			DataDiff:     dataDiff,
			RiskLevel:    riskLevel,
			ResourceType: resourceType,
			ResourceID:   resourceID,
		}

		// Generate integrity hash
		hashInput := audit.HashInput{
			AdminID:    entry.AdminID,
			Username:   entry.Username,
			Action:     entry.Action,
			Method:     entry.Method,
			Path:       entry.Path,
			StatusCode: entry.StatusCode,
			Metadata:   string(entry.Metadata),
			DataDiff:   string(entry.DataDiff),
			RiskLevel:  entry.RiskLevel,
			CreatedAt:  audit.FormatCreatedAt(createdAt),
		}
		entry.IntegrityHash = audit.GenerateIntegrityHash(hashInput)

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

// RequirePermission enforces RBAC for admin routes. superadmin bypasses checks.
func RequirePermission(perms ...Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		admin, ok := getAdminFromContext(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		if isReadOnlyRole(admin.Role) && !isReadOnlyMethod(c.Request.Method) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Read-only role cannot modify data"})
			return
		}
		for _, p := range perms {
			if userHasPermission(admin, p) {
				continue
			}
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

	// Check if 2FA is required
	requires2FA := user.TwoFactorEnabled
	if !requires2FA && (user.TwoFactorRequired || services.IsForceAdmin2FAEnabled()) {
		// User needs to setup 2FA but hasn't yet - allow login but flag it
		requires2FA = false
	}

	// Check for trusted device
	deviceToken := c.GetHeader("X-Device-Token")
	if requires2FA && deviceToken != "" {
		trusted, _ := services.ValidateTrustedDevice(database.GetDB(), user.ID, deviceToken)
		if trusted {
			requires2FA = false
		}
	}

	// If 2FA is required, return a temporary token for 2FA step
	if requires2FA {
		twoFAToken, exp, err := services.Generate2FAToken(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate 2FA token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"requiresTwoFA": true,
			"twoFAToken":    twoFAToken,
			"expiresAt":     exp.Unix(),
		})
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

	var customPerms []string
	if len(user.Permissions) > 0 {
		_ = json.Unmarshal(user.Permissions, &customPerms)
	}

	// Check if user needs to setup 2FA (forced but not enabled)
	needs2FASetup := !user.TwoFactorEnabled && (user.TwoFactorRequired || services.IsForceAdmin2FAEnabled())

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"token":     token,
		"expiresAt": exp.Unix(),
		"user": gin.H{
			"id":                   user.ID,
			"username":             user.Username,
			"role":                 user.Role,
			"permissions":          customPerms,
			"effectivePermissions": getUserPermissions(user),
			"lastLoginAt":          user.LastLoginAt,
			"lastLoginIp":          user.LastLoginIP,
			"twoFactorEnabled":     user.TwoFactorEnabled,
			"twoFactorRequired":    user.TwoFactorRequired,
		},
		"needs2FASetup": needs2FASetup,
	})
}

// GetAdminProfile returns the current admin's profile.
func GetAdminProfile(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var customPerms []string
	if len(admin.Permissions) > 0 {
		_ = json.Unmarshal(admin.Permissions, &customPerms)
	}

	// Check if user needs to setup 2FA (forced but not enabled)
	needs2FASetup := !admin.TwoFactorEnabled && (admin.TwoFactorRequired || services.IsForceAdmin2FAEnabled())

	c.JSON(http.StatusOK, gin.H{
		"id":                   admin.ID,
		"username":             admin.Username,
		"role":                 admin.Role,
		"permissions":          customPerms,
		"effectivePermissions": getUserPermissions(admin),
		"lastLoginAt":          admin.LastLoginAt,
		"lastLoginIp":          admin.LastLoginIP,
		"createdAt":            admin.CreatedAt,
		"twoFactorEnabled":     admin.TwoFactorEnabled,
		"twoFactorRequired":    admin.TwoFactorRequired,
		"needs2FASetup":        needs2FASetup,
	})
}

// ListAdminUsers lists all admin accounts (super admin only).
func ListAdminUsers(c *gin.Context) {
	var admins []database.AdminUser
	if err := database.GetDB().Order("created_at desc").Find(&admins).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build response with effective permissions
	result := make([]gin.H, len(admins))
	for i, admin := range admins {
		var customPerms []string
		if len(admin.Permissions) > 0 {
			_ = json.Unmarshal(admin.Permissions, &customPerms)
		}
		result[i] = gin.H{
			"id":                   admin.ID,
			"username":             admin.Username,
			"role":                 admin.Role,
			"permissions":          customPerms,
			"effectivePermissions": getUserPermissions(admin),
			"isActive":             admin.IsActive,
			"lastLoginAt":          admin.LastLoginAt,
			"lastLoginIp":          admin.LastLoginIP,
			"createdAt":            admin.CreatedAt,
			"updatedAt":            admin.UpdatedAt,
			"twoFactorEnabled":     admin.TwoFactorEnabled,
			"twoFactorRequired":    admin.TwoFactorRequired,
			"twoFactorVerifiedAt":  admin.TwoFactorVerifiedAt,
			"twoFactorPending":     admin.TwoFactorSecret != "" && !admin.TwoFactorEnabled, // Has unverified secret
		}
	}

	c.JSON(http.StatusOK, result)
}

// CreateAdminUser creates a new admin account (super admin only).
func CreateAdminUser(c *gin.Context) {
	current, ok := getAdminFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Username    string   `json:"username"`
		Password    string   `json:"password"`
		Role        string   `json:"role"`
		Permissions []string `json:"permissions"` // Custom permissions (optional)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	role := req.Role
	if role == "" {
		role = database.AdminRoleStandard
	}
	if !isValidAdminRole(role) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	// Only superadmin can create another superadmin
	if role == database.AdminRoleSuper && current.Role != database.AdminRoleSuper {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only superadmin can create superadmin accounts"})
		return
	}

	if strings.TrimSpace(req.Username) == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required"})
		return
	}

	// Validate custom permissions if provided
	var permissionsJSON []byte
	if len(req.Permissions) > 0 {
		if err := validatePermissions(req.Permissions); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		permissionsJSON, _ = json.Marshal(req.Permissions)
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
		Permissions:  permissionsJSON,
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

	// Record create state for audit diff
	audit.SetCreateState(c, "admin_user", admin.ID, admin)

	c.Set("auditMetadata", map[string]any{
		"createdUser": admin.Username,
		"role":        admin.Role,
		"permissions": req.Permissions,
	})

	c.JSON(http.StatusCreated, gin.H{
		"id":                   admin.ID,
		"username":             admin.Username,
		"role":                 admin.Role,
		"permissions":          req.Permissions,
		"effectivePermissions": getUserPermissions(admin),
		"createdAt":            admin.CreatedAt,
	})
}

// UpdateAdminUser updates role/activation/permissions for an admin (super admin only).
func UpdateAdminUser(c *gin.Context) {
	current, ok := getAdminFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid admin id"})
		return
	}

	var req struct {
		Role        *string   `json:"role"`
		IsActive    *bool     `json:"isActive"`
		Permissions *[]string `json:"permissions"` // Custom permissions (null = use role defaults, [] = clear custom)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.Role == nil && req.IsActive == nil && req.Permissions == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No changes provided"})
		return
	}

	var target database.AdminUser
	if err := database.GetDB().First(&target, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Admin not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record before state for audit diff
	audit.SetBeforeState(c, "admin_user", target.ID, target)

	// Prevent self-lockout via role change or deactivation
	if target.ID == current.ID {
		if req.Role != nil && strings.TrimSpace(*req.Role) != target.Role {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change your own role"})
			return
		}
		if req.IsActive != nil && !*req.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot deactivate yourself"})
			return
		}
		if req.Permissions != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change your own permissions"})
			return
		}
	}

	updates := map[string]any{}
	prevRole := target.Role
	prevActive := target.IsActive
	var prevPerms []string
	if len(target.Permissions) > 0 {
		_ = json.Unmarshal(target.Permissions, &prevPerms)
	}

	if req.Role != nil {
		role := strings.TrimSpace(*req.Role)
		if !isValidAdminRole(role) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
			return
		}
		// Only superadmin can assign superadmin role
		if role == database.AdminRoleSuper && current.Role != database.AdminRoleSuper {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only superadmin can assign superadmin role"})
			return
		}
		if target.Role == database.AdminRoleSuper && role != database.AdminRoleSuper {
			var count int64
			if err := database.GetDB().Model(&database.AdminUser{}).
				Where("role = ? AND is_active = ?", database.AdminRoleSuper, true).
				Count(&count).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate super admin count"})
				return
			}
			if count <= 1 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove the last active superadmin"})
				return
			}
		}
		updates["role"] = role
		target.Role = role
	}

	if req.IsActive != nil {
		if target.Role == database.AdminRoleSuper && !*req.IsActive {
			var count int64
			if err := database.GetDB().Model(&database.AdminUser{}).
				Where("role = ? AND is_active = ?", database.AdminRoleSuper, true).
				Count(&count).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate super admin count"})
				return
			}
			if count <= 1 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot deactivate the last active superadmin"})
				return
			}
		}
		updates["is_active"] = *req.IsActive
		target.IsActive = *req.IsActive
	}

	if req.Permissions != nil {
		if len(*req.Permissions) > 0 {
			if err := validatePermissions(*req.Permissions); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			permJSON, _ := json.Marshal(*req.Permissions)
			updates["permissions"] = permJSON
			target.Permissions = permJSON
		} else {
			// Empty array = clear custom permissions (use role defaults)
			updates["permissions"] = nil
			target.Permissions = nil
		}
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid changes"})
		return
	}

	if err := database.GetDB().Model(&target).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state for audit diff
	audit.SetAfterState(c, target)

	var newPerms []string
	if len(target.Permissions) > 0 {
		_ = json.Unmarshal(target.Permissions, &newPerms)
	}

	c.Set("auditMetadata", map[string]any{
		"targetUser":      target.Username,
		"targetId":        target.ID,
		"fromRole":        prevRole,
		"toRole":          target.Role,
		"fromActive":      prevActive,
		"toActive":        target.IsActive,
		"fromPermissions": prevPerms,
		"toPermissions":   newPerms,
	})

	c.JSON(http.StatusOK, gin.H{
		"id":                   target.ID,
		"username":             target.Username,
		"role":                 target.Role,
		"permissions":          newPerms,
		"effectivePermissions": getUserPermissions(target),
		"isActive":             target.IsActive,
		"lastLoginAt":          target.LastLoginAt,
		"lastLoginIp":          target.LastLoginIP,
		"createdAt":            target.CreatedAt,
		"updatedAt":            target.UpdatedAt,
	})
}

// ResetAdminPassword allows super admin to reset another admin's password.
func ResetAdminPassword(c *gin.Context) {
	current, ok := getAdminFromContext(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid admin id"})
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required"})
		return
	}
	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 8 characters"})
		return
	}

	var target database.AdminUser
	if err := database.GetDB().First(&target, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Admin not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Prevent resetting own password (use ChangePasswordHandler instead)
	if target.ID == current.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Use the change password feature for your own account"})
		return
	}

	hash, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := database.GetDB().Model(&target).Update("password_hash", hash).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Set("auditMetadata", map[string]any{
		"targetUser": target.Username,
		"targetId":   target.ID,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
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

// VerifyAuditLogsHandler verifies the integrity of audit logs (superadmin only).
// Supports optional query parameters: from, to (RFC3339 timestamps), limit (max 1000).
func VerifyAuditLogsHandler(c *gin.Context) {
	limit := 500
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "500")); err == nil && l > 0 && l <= 1000 {
		limit = l
	}

	query := database.GetDB().Order("created_at desc").Limit(limit)

	// Optional time range filtering
	if from := c.Query("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			query = query.Where("created_at >= ?", t)
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			query = query.Where("created_at <= ?", t)
		}
	}

	var logs []database.AdminAuditLog
	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	valid := 0
	tampered := 0
	details := make([]gin.H, 0, len(logs))

	for _, log := range logs {
		hashInput := audit.HashInput{
			AdminID:    log.AdminID,
			Username:   log.Username,
			Action:     log.Action,
			Method:     log.Method,
			Path:       log.Path,
			StatusCode: log.StatusCode,
			Metadata:   string(log.Metadata),
			DataDiff:   string(log.DataDiff),
			RiskLevel:  log.RiskLevel,
			CreatedAt:  audit.FormatCreatedAt(log.CreatedAt),
		}

		isValid := audit.VerifyIntegrity(hashInput, log.IntegrityHash)
		if isValid {
			valid++
		} else {
			tampered++
		}

		details = append(details, gin.H{
			"id":        log.ID,
			"valid":     isValid,
			"createdAt": log.CreatedAt,
			"action":    log.Action,
			"riskLevel": log.RiskLevel,
		})
	}

	response := gin.H{
		"total":    len(logs),
		"checked":  len(logs),
		"valid":    valid,
		"tampered": tampered,
	}

	// Only include details if there are tampered logs or if explicitly requested
	if tampered > 0 || c.Query("details") == "true" {
		response["details"] = details
	}

	c.JSON(http.StatusOK, response)
}

func getAdminFromContext(c *gin.Context) (database.AdminUser, bool) {
	adminVal, ok := c.Get("adminUser")
	if !ok {
		return database.AdminUser{}, false
	}
	admin, ok := adminVal.(database.AdminUser)
	return admin, ok
}

// userHasPermission checks if a user has a specific permission.
// Priority: custom permissions > role template defaults
func userHasPermission(user database.AdminUser, perm Permission) bool {
	// Superadmin always has all permissions
	if user.Role == database.AdminRoleSuper {
		return true
	}

	// Check custom permissions if set
	if len(user.Permissions) > 0 {
		var customPerms []string
		if err := json.Unmarshal(user.Permissions, &customPerms); err == nil && len(customPerms) > 0 {
			for _, p := range customPerms {
				if Permission(p) == perm {
					return true
				}
			}
			return false // Custom permissions are set but don't include this one
		}
	}

	// Fall back to role template
	allowed, ok := RolePermissionTemplates[user.Role]
	if !ok {
		return false
	}
	_, ok = allowed[perm]
	return ok
}

// getUserPermissions returns the effective permissions for a user
func getUserPermissions(user database.AdminUser) []string {
	if user.Role == database.AdminRoleSuper {
		perms := make([]string, len(AllPermissions))
		for i, p := range AllPermissions {
			perms[i] = string(p)
		}
		return perms
	}

	// Check custom permissions first
	if len(user.Permissions) > 0 {
		var customPerms []string
		if err := json.Unmarshal(user.Permissions, &customPerms); err == nil && len(customPerms) > 0 {
			return customPerms
		}
	}

	// Fall back to role template
	template, ok := RolePermissionTemplates[user.Role]
	if !ok {
		return []string{}
	}
	perms := make([]string, 0, len(template))
	for p := range template {
		perms = append(perms, string(p))
	}
	return perms
}

func isValidAdminRole(role string) bool {
	switch role {
	case database.AdminRoleSuper,
		database.AdminRoleStandard,
		database.AdminRoleContent,
		database.AdminRoleData,
		database.AdminRoleAnalyst,
		database.AdminRoleCrisis,
		database.AdminRoleViewer:
		return true
	default:
		return false
	}
}

func isReadOnlyRole(role string) bool {
	return role == database.AdminRoleViewer
}

func isReadOnlyMethod(method string) bool {
	switch strings.ToUpper(method) {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	default:
		return false
	}
}

// validatePermissions checks if all permissions in the list are valid
func validatePermissions(perms []string) error {
	validPerms := make(map[string]struct{}, len(AllPermissions))
	for _, p := range AllPermissions {
		validPerms[string(p)] = struct{}{}
	}
	for _, p := range perms {
		if _, ok := validPerms[p]; !ok {
			return fmt.Errorf("invalid permission: %s", p)
		}
	}
	return nil
}

// GetPermissionTemplates returns all role permission templates for the UI
func GetPermissionTemplates(c *gin.Context) {
	templates := make(map[string][]string)
	for role, perms := range RolePermissionTemplates {
		permList := make([]string, 0, len(perms))
		for p := range perms {
			permList = append(permList, string(p))
		}
		templates[role] = permList
	}

	allPerms := make([]string, len(AllPermissions))
	for i, p := range AllPermissions {
		allPerms[i] = string(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"allPermissions": allPerms,
		"roleTemplates":  templates,
	})
}

type auditRequestContext struct {
	PathParams    map[string]string
	Query         map[string]any
	Body          any
	BodyTruncated bool
}

func captureAuditRequest(c *gin.Context) auditRequestContext {
	ctx := auditRequestContext{
		PathParams: map[string]string{},
	}

	for _, param := range c.Params {
		key := strings.ToLower(param.Key)
		if isSensitiveKey(key) {
			ctx.PathParams[param.Key] = "[redacted]"
			continue
		}
		ctx.PathParams[param.Key] = param.Value
	}
	if len(ctx.PathParams) == 0 {
		ctx.PathParams = nil
	}

	if c.Request != nil {
		query := c.Request.URL.Query()
		if len(query) > 0 {
			ctx.Query = make(map[string]any, len(query))
			for k, vals := range query {
				if isSensitiveKey(strings.ToLower(k)) {
					ctx.Query[k] = "[redacted]"
					continue
				}
				if len(vals) == 1 {
					ctx.Query[k] = truncateForAudit(vals[0], maxAuditString)
					continue
				}
				items := make([]string, len(vals))
				for i, v := range vals {
					items[i] = truncateForAudit(v, maxAuditString)
				}
				ctx.Query[k] = items
			}
		}
	}

	body, truncated := captureRequestBody(c)
	ctx.Body = body
	ctx.BodyTruncated = truncated

	return ctx
}

func captureRequestBody(c *gin.Context) (any, bool) {
	if c.Request == nil || c.Request.Body == nil || !shouldLogBody(c.Request.Method) {
		return nil, false
	}

	if c.Request.ContentLength > maxAuditCaptureBytes && c.Request.ContentLength != -1 {
		return fmt.Sprintf("[skipped logging body larger than %d bytes]", maxAuditCaptureBytes), true
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return "[unreadable body]", false
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	truncated := len(bodyBytes) > maxAuditBodyBytes
	loggableBytes := bodyBytes
	if truncated {
		loggableBytes = bodyBytes[:maxAuditBodyBytes]
	}

	if len(bytes.TrimSpace(loggableBytes)) == 0 {
		return nil, truncated
	}

	var obj any
	if err := json.Unmarshal(loggableBytes, &obj); err == nil {
		return sanitizeAuditValue(obj), truncated
	}

	return truncateForAudit(string(loggableBytes), maxAuditString), truncated
}

func shouldLogBody(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	default:
		return true
	}
}

type auditResponseRecorder struct {
	gin.ResponseWriter
	buf       bytes.Buffer
	limit     int
	truncated bool
}

func newAuditResponseRecorder(writer gin.ResponseWriter, limit int) *auditResponseRecorder {
	return &auditResponseRecorder{
		ResponseWriter: writer,
		limit:          limit,
	}
}

func (r *auditResponseRecorder) Write(b []byte) (int, error) {
	if r.limit > 0 && r.buf.Len() < r.limit {
		remaining := r.limit - r.buf.Len()
		if len(b) > remaining {
			r.buf.Write(b[:remaining])
			r.truncated = true
		} else {
			r.buf.Write(b)
		}
	} else if r.limit > 0 {
		r.truncated = true
	}
	return r.ResponseWriter.Write(b)
}

func (r *auditResponseRecorder) WriteString(s string) (int, error) {
	return r.Write([]byte(s))
}

func (r *auditResponseRecorder) Sample() string {
	return strings.TrimSpace(r.buf.String())
}

func (r *auditResponseRecorder) Truncated() bool {
	return r.truncated
}

func sanitizeAuditValue(value any) any {
	switch v := value.(type) {
	case map[string]any:
		clean := make(map[string]any, len(v))
		for k, val := range v {
			if isSensitiveKey(strings.ToLower(k)) {
				clean[k] = "[redacted]"
				continue
			}
			clean[k] = sanitizeAuditValue(val)
		}
		return clean
	case []any:
		clean := make([]any, len(v))
		for i, item := range v {
			clean[i] = sanitizeAuditValue(item)
		}
		return clean
	case string:
		return truncateForAudit(v, maxAuditString)
	default:
		return v
	}
}

var auditSensitiveKeys = []string{
	"password",
	"pass",
	"pwd",
	"token",
	"secret",
	"api_key",
	"apikey",
	"api-key",
	"openai",
	"authorization",
	"credential",
}

func isSensitiveKey(key string) bool {
	for _, marker := range auditSensitiveKeys {
		if strings.Contains(key, marker) {
			return true
		}
	}
	return false
}

func truncateForAudit(val string, limit int) string {
	if limit <= 0 || len(val) <= limit {
		return val
	}
	return val[:limit] + "...[truncated]"
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

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	raw := strings.TrimSpace(c.Param(name))
	id64, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return 0, false
	}
	maxUint := ^uint(0)
	if id64 > uint64(maxUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID out of range"})
		return 0, false
	}
	return uint(id64), true
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
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var existing database.TraitDimensionDB
	if err := database.GetDB().First(&existing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dimension not found"})
		return
	}

	// Record before state for audit diff
	audit.SetBeforeState(c, "dimension", id, existing)

	var dim database.TraitDimensionDB
	if err := c.ShouldBindJSON(&dim); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	dim.ID = id
	if err := database.GetDB().Save(&dim).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state for audit diff
	audit.SetAfterState(c, dim)

	c.JSON(http.StatusOK, dim)
}

func DeleteDimension(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}

	// Record before state for audit diff (delete operation)
	var existing database.TraitDimensionDB
	if err := database.GetDB().First(&existing, id).Error; err == nil {
		audit.SetDeleteState(c, "dimension", id, existing)
	}

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
	var input database.QuizQuestionDB
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if question with same questionId exists (including soft-deleted)
	var existing database.QuizQuestionDB
	if err := database.GetDB().Unscoped().Where("question_id = ?", input.QuestionID).First(&existing).Error; err == nil {
		// QuestionID exists - update and reactivate
		existing.Order = input.Order
		existing.QuestionZH = input.QuestionZH
		existing.QuestionEN = input.QuestionEN
		existing.Options = input.Options
		existing.PrimaryDimensionID = input.PrimaryDimensionID
		existing.IsActive = true
		existing.Version++
		if err := database.GetDB().Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, existing)
		return
	}

	// Create new question
	input.IsActive = true
	input.Version = 1
	if err := database.GetDB().Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, input)
}

func UpdateQuestion(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var existing database.QuizQuestionDB
	if err := database.GetDB().First(&existing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
		return
	}

	// Record before state for audit diff
	audit.SetBeforeState(c, "question", id, existing)

	var question database.QuizQuestionDB
	if err := c.ShouldBindJSON(&question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	question.ID = id
	if err := database.GetDB().Save(&question).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state for audit diff
	audit.SetAfterState(c, question)

	c.JSON(http.StatusOK, question)
}

func DeleteQuestion(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}

	// Record before state for audit diff (soft delete)
	var existing database.QuizQuestionDB
	if err := database.GetDB().First(&existing, id).Error; err == nil {
		audit.SetBeforeState(c, "question", id, existing)
	}

	// Soft delete by setting IsActive = false
	if err := database.GetDB().Model(&database.QuizQuestionDB{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state (soft deleted)
	existing.IsActive = false
	audit.SetAfterState(c, existing)

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

	// Check if glowtype with same typeCode already exists (including inactive ones)
	var existing database.GlowtypeDB
	if err := database.GetDB().Unscoped().Where("type_code = ?", input.TypeCode).First(&existing).Error; err == nil {
		// TypeCode exists - update and reactivate it
		existing.PrimaryColor = input.PrimaryColor
		existing.AuraGradient = input.Gradient
		existing.CardAccent = input.CardAccent
		existing.TextColor = input.TextColor
		existing.IsActive = true
		existing.Version++
		if err := database.GetDB().Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Update or create i18n records
		updateOrCreateI18N(existing.ID, "zh", input.NameZh, input.TaglineZh, input.DescriptionZh, input.SelfCareTipsZh, input.DisclaimerZh)
		updateOrCreateI18N(existing.ID, "en", input.NameEn, input.TaglineEn, input.DescriptionEn, input.SelfCareTipsEn, input.DisclaimerEn)

		input.ID = existing.ID
		c.JSON(http.StatusOK, input)
		return
	}

	// Create new glowtype record
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

// updateOrCreateI18N updates existing i18n record or creates a new one
func updateOrCreateI18N(glowtypeID uint, lang, name, tagline, description, tips, disclaimer string) {
	if name == "" && tagline == "" && description == "" {
		return
	}
	var i18n database.GlowtypeI18NDB
	err := database.GetDB().Where("glowtype_id = ? AND lang = ?", glowtypeID, lang).First(&i18n).Error
	if err == nil {
		// Update existing
		i18n.Name = name
		i18n.Tagline = tagline
		i18n.Description = description
		i18n.SelfCareTips = tips
		i18n.Disclaimer = disclaimer
		database.GetDB().Save(&i18n)
	} else {
		// Create new
		i18n = database.GlowtypeI18NDB{
			GlowtypeID:   glowtypeID,
			Lang:         lang,
			Name:         name,
			Tagline:      tagline,
			Description:  description,
			SelfCareTips: tips,
			Disclaimer:   disclaimer,
		}
		database.GetDB().Create(&i18n)
	}
}

func UpdateGlowtype(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
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
		zhI18n = database.GlowtypeI18NDB{GlowtypeID: id, Lang: "zh"}
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
		enI18n = database.GlowtypeI18NDB{GlowtypeID: id, Lang: "en"}
	}
	enI18n.Name = input.NameEn
	enI18n.Tagline = input.TaglineEn
	enI18n.Description = input.DescriptionEn
	enI18n.SelfCareTips = input.SelfCareTipsEn
	enI18n.Disclaimer = input.DisclaimerEn
	db.Save(&enI18n)

	// Return merged result
	input.ID = id
	c.JSON(http.StatusOK, input)
}

func DeleteGlowtype(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
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
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
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
	i18n.ID = id
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
	var input database.ScoringRuleDB
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if rule with same name exists (including soft-deleted)
	var existing database.ScoringRuleDB
	if err := database.GetDB().Unscoped().Where("name = ?", input.Name).First(&existing).Error; err == nil {
		// Name exists - update and reactivate
		existing.Description = input.Description
		existing.Conditions = input.Conditions
		existing.ResultTypeCode = input.ResultTypeCode
		existing.Priority = input.Priority
		existing.IsFallback = input.IsFallback
		existing.IsActive = true
		existing.Version++
		if err := database.GetDB().Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, existing)
		return
	}

	// Create new rule
	input.IsActive = true
	input.Version = 1
	if err := database.GetDB().Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, input)
}

func UpdateRule(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var existing database.ScoringRuleDB
	if err := database.GetDB().First(&existing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	}

	// Record before state for audit diff
	audit.SetBeforeState(c, "scoring_rule", id, existing)

	var rule database.ScoringRuleDB
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Ensure ID is preserved after JSON binding
	rule.ID = id
	if err := database.GetDB().Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state for audit diff
	audit.SetAfterState(c, rule)

	c.JSON(http.StatusOK, rule)
}

func DeleteRule(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}

	// Record before state for audit diff (soft delete)
	var existing database.ScoringRuleDB
	if err := database.GetDB().First(&existing, id).Error; err == nil {
		audit.SetBeforeState(c, "scoring_rule", id, existing)
	}

	if err := database.GetDB().Model(&database.ScoringRuleDB{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record after state (soft deleted)
	existing.IsActive = false
	audit.SetAfterState(c, existing)

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

	// Record before state for audit diff
	audit.SetBeforeState(c, "ai_prompt", prompt.ID, prompt)

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

	// Record after state for audit diff
	audit.SetAfterState(c, prompt)

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

// ============ AI Settings ============

// GetAISettings returns the current AI configuration
func GetAISettings(c *gin.Context) {
	settings, err := database.GetAISettings(database.GetDB())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return settings with masked API key
	hasKey := settings.APIKey != ""
	maskedKey := ""
	if hasKey && len(settings.APIKey) > 8 {
		maskedKey = settings.APIKey[:4] + "****" + settings.APIKey[len(settings.APIKey)-4:]
	} else if hasKey {
		maskedKey = "****"
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                      settings.ID,
		"provider":                settings.Provider,
		"baseUrl":                 settings.BaseURL,
		"model":                   settings.Model,
		"isActive":                settings.IsActive,
		"hasApiKey":               hasKey,
		"apiKey":                  maskedKey,
		"rateLimitEnabled":        settings.RateLimitEnabled,
		"rateLimitRequestsPerMin": settings.RateLimitRequestsPerMin,
		"rateLimitBurst":          settings.RateLimitBurst,
		"updatedAt":               settings.UpdatedAt,
	})
}

// UpdateAISettings updates the AI configuration
func UpdateAISettings(c *gin.Context) {
	var req struct {
		Provider                *string `json:"provider"`
		APIKey                  *string `json:"apiKey"`
		BaseURL                 *string `json:"baseUrl"`
		Model                   *string `json:"model"`
		IsActive                *bool   `json:"isActive"`
		RateLimitEnabled        *bool   `json:"rateLimitEnabled"`
		RateLimitRequestsPerMin *int    `json:"rateLimitRequestsPerMin"`
		RateLimitBurst          *int    `json:"rateLimitBurst"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	settings, err := database.GetAISettings(database.GetDB())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record before state for audit diff (sensitive fields auto-redacted)
	audit.SetBeforeState(c, "ai_settings", settings.ID, settings)

	updates := map[string]any{}

	if req.Provider != nil {
		provider := strings.TrimSpace(*req.Provider)
		if provider != "openai" && provider != "mock" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider, must be 'openai' or 'mock'"})
			return
		}
		updates["provider"] = provider
	}

	if req.APIKey != nil {
		// Only update if not the masked placeholder
		key := strings.TrimSpace(*req.APIKey)
		if !strings.Contains(key, "****") {
			updates["api_key"] = key
		}
	}

	if req.BaseURL != nil {
		updates["base_url"] = strings.TrimRight(strings.TrimSpace(*req.BaseURL), "/")
	}

	if req.Model != nil {
		updates["model"] = strings.TrimSpace(*req.Model)
	}

	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if req.RateLimitEnabled != nil {
		updates["rate_limit_enabled"] = *req.RateLimitEnabled
	}
	if req.RateLimitRequestsPerMin != nil {
		if *req.RateLimitRequestsPerMin <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rateLimitRequestsPerMin must be greater than 0"})
			return
		}
		updates["rate_limit_requests_per_min"] = *req.RateLimitRequestsPerMin
	}
	if req.RateLimitBurst != nil {
		if *req.RateLimitBurst <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rateLimitBurst must be greater than 0"})
			return
		}
		updates["rate_limit_burst"] = *req.RateLimitBurst
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No changes provided"})
		return
	}

	if err := database.GetDB().Model(settings).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload settings
	settings, _ = database.GetAISettings(database.GetDB())

	// Record after state for audit diff
	audit.SetAfterState(c, settings)

	hasKey := settings.APIKey != ""
	maskedKey := ""
	if hasKey && len(settings.APIKey) > 8 {
		maskedKey = settings.APIKey[:4] + "****" + settings.APIKey[len(settings.APIKey)-4:]
	} else if hasKey {
		maskedKey = "****"
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                      settings.ID,
		"provider":                settings.Provider,
		"baseUrl":                 settings.BaseURL,
		"model":                   settings.Model,
		"isActive":                settings.IsActive,
		"hasApiKey":               hasKey,
		"apiKey":                  maskedKey,
		"rateLimitEnabled":        settings.RateLimitEnabled,
		"rateLimitRequestsPerMin": settings.RateLimitRequestsPerMin,
		"rateLimitBurst":          settings.RateLimitBurst,
		"updatedAt":               settings.UpdatedAt,
	})
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
	Success  bool          `json:"success"`
	Mode     ImportMode    `json:"mode"`
	Total    int           `json:"total"`
	Created  int           `json:"created"`
	Updated  int           `json:"updated"`
	Skipped  int           `json:"skipped"`
	Errors   []ImportError `json:"errors,omitempty"`
	Warnings []string      `json:"warnings,omitempty"`
}

// ImportError describes an error for a specific item
type ImportError struct {
	Index   int    `json:"index"`
	ID      string `json:"id,omitempty"`
	Message string `json:"message"`
}

// QuestionImportItem represents a question in import format
type QuestionImportItem struct {
	QuestionID         string                  `json:"questionId"`
	Order              int                     `json:"order"`
	QuestionZH         string                  `json:"questionZh"`
	QuestionEN         string                  `json:"questionEn"`
	Options            []database.OptionConfig `json:"options"`
	PrimaryDimensionID *uint                   `json:"primaryDimensionId,omitempty"`
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
	Name           string                  `json:"name"`
	Description    string                  `json:"description,omitempty"`
	Conditions     database.RuleConditions `json:"conditions"`
	ResultTypeCode string                  `json:"resultTypeCode"`
	Priority       int                     `json:"priority"`
	IsFallback     bool                    `json:"isFallback"`
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

// ============================================================
// DIMENSION IMPORT/EXPORT HANDLERS
// ============================================================

// DimensionImportItem represents a trait dimension in import format
type DimensionImportItem struct {
	Key             string  `json:"key"`
	NameZH          string  `json:"nameZh"`
	NameEN          string  `json:"nameEn"`
	PositivePole    string  `json:"positivePole"`
	NegativePole    string  `json:"negativePole"`
	Description     string  `json:"description,omitempty"`
	StrongThreshold float64 `json:"strongThreshold"`
	MildThreshold   float64 `json:"mildThreshold"`
	DisplayOrder    int     `json:"displayOrder"`
}

// ImportDimensions handles bulk dimension import with validation
func ImportDimensions(c *gin.Context) {
	var req struct {
		Mode  ImportMode            `json:"mode"`
		Items []DimensionImportItem `json:"items"`
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
	if len(req.Items) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Too many items. Maximum 100 dimensions per import"})
		return
	}

	// Validate all items first
	result := ImportResult{
		Mode:  req.Mode,
		Total: len(req.Items),
	}

	seenKeys := make(map[string]int) // Track duplicate keys within import
	for i, item := range req.Items {
		errors := validateDimensionItem(item, i)

		// Check for duplicate key within import
		if prev, exists := seenKeys[item.Key]; exists {
			errors = append(errors, ImportError{
				Index:   i,
				ID:      item.Key,
				Message: fmt.Sprintf("Duplicate key '%s' (first seen at index %d)", item.Key, prev),
			})
		}
		seenKeys[item.Key] = i

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

		// Hard delete all existing dimensions
		if err := tx.Unscoped().Where("1=1").Delete(&database.TraitDimensionDB{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete existing dimensions: " + err.Error()})
			return
		}

		// Import all items
		for _, item := range req.Items {
			dim := database.TraitDimensionDB{
				Key:             item.Key,
				NameZH:          item.NameZH,
				NameEN:          item.NameEN,
				PositivePole:    item.PositivePole,
				NegativePole:    item.NegativePole,
				Description:     item.Description,
				StrongThreshold: item.StrongThreshold,
				MildThreshold:   item.MildThreshold,
				DisplayOrder:    item.DisplayOrder,
			}
			if err := tx.Create(&dim).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create dimension '%s': %s", item.Key, err.Error())})
				return
			}
			result.Created++
		}

		tx.Commit()
	} else {
		// Merge mode: upsert each item
		for _, item := range req.Items {
			var existing database.TraitDimensionDB
			err := db.Where("key = ?", item.Key).First(&existing).Error

			if errors.Is(err, gorm.ErrRecordNotFound) {
				// Create new
				dim := database.TraitDimensionDB{
					Key:             item.Key,
					NameZH:          item.NameZH,
					NameEN:          item.NameEN,
					PositivePole:    item.PositivePole,
					NegativePole:    item.NegativePole,
					Description:     item.Description,
					StrongThreshold: item.StrongThreshold,
					MildThreshold:   item.MildThreshold,
					DisplayOrder:    item.DisplayOrder,
				}
				if err := db.Create(&dim).Error; err != nil {
					result.Errors = append(result.Errors, ImportError{
						ID:      item.Key,
						Message: "Failed to create: " + err.Error(),
					})
					result.Skipped++
					continue
				}
				result.Created++
			} else if err != nil {
				result.Errors = append(result.Errors, ImportError{
					ID:      item.Key,
					Message: "Database error: " + err.Error(),
				})
				result.Skipped++
			} else {
				// Update existing
				existing.NameZH = item.NameZH
				existing.NameEN = item.NameEN
				existing.PositivePole = item.PositivePole
				existing.NegativePole = item.NegativePole
				existing.Description = item.Description
				existing.StrongThreshold = item.StrongThreshold
				existing.MildThreshold = item.MildThreshold
				existing.DisplayOrder = item.DisplayOrder
				if err := db.Save(&existing).Error; err != nil {
					result.Errors = append(result.Errors, ImportError{
						ID:      item.Key,
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

// validateDimensionItem validates a single dimension import item
func validateDimensionItem(item DimensionImportItem, index int) []ImportError {
	var errors []ImportError

	// Required: key
	if strings.TrimSpace(item.Key) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			Message: "key is required",
		})
	} else if len(item.Key) > 50 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "key too long (max 50 characters)",
		})
	} else if !isValidDimensionKey(item.Key) {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "key must contain only lowercase letters, numbers, and underscores",
		})
	}

	// Required: at least one name
	if strings.TrimSpace(item.NameZH) == "" && strings.TrimSpace(item.NameEN) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "At least one of nameZh or nameEn is required",
		})
	}

	// Required: positivePole and negativePole
	if strings.TrimSpace(item.PositivePole) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "positivePole is required",
		})
	}
	if strings.TrimSpace(item.NegativePole) == "" {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "negativePole is required",
		})
	}

	// Validate thresholds
	if item.StrongThreshold < 0 || item.StrongThreshold > 100 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "strongThreshold must be between 0 and 100",
		})
	}
	if item.MildThreshold < 0 || item.MildThreshold > 100 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "mildThreshold must be between 0 and 100",
		})
	}
	if item.MildThreshold > item.StrongThreshold {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "mildThreshold cannot be greater than strongThreshold",
		})
	}

	// Validate displayOrder
	if item.DisplayOrder < 0 || item.DisplayOrder > 1000 {
		errors = append(errors, ImportError{
			Index:   index,
			ID:      item.Key,
			Message: "displayOrder must be between 0 and 1000",
		})
	}

	return errors
}

// isValidDimensionKey checks if a dimension key follows naming conventions
func isValidDimensionKey(key string) bool {
	for _, r := range key {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_') {
			return false
		}
	}
	return true
}

// ExportDimensions exports all trait dimensions in import-compatible format
func ExportDimensions(c *gin.Context) {
	var dimensions []database.TraitDimensionDB
	if err := database.GetDB().Order("display_order asc").Find(&dimensions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert to export format
	items := make([]DimensionImportItem, 0, len(dimensions))
	for _, d := range dimensions {
		items = append(items, DimensionImportItem{
			Key:             d.Key,
			NameZH:          d.NameZH,
			NameEN:          d.NameEN,
			PositivePole:    d.PositivePole,
			NegativePole:    d.NegativePole,
			Description:     d.Description,
			StrongThreshold: d.StrongThreshold,
			MildThreshold:   d.MildThreshold,
			DisplayOrder:    d.DisplayOrder,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"count": len(items),
	})
}

// ============================================================
// RESET TO DEFAULTS HANDLERS
// ============================================================

// ResetDimensionsHandler resets trait dimensions to default values
func ResetDimensionsHandler(c *gin.Context) {
	db := database.GetDB()

	// Count existing records before reset
	var countBefore int64
	db.Model(&database.TraitDimensionDB{}).Count(&countBefore)

	if err := database.ResetDimensions(db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset dimensions: " + err.Error()})
		return
	}

	var countAfter int64
	db.Model(&database.TraitDimensionDB{}).Count(&countAfter)

	c.Set("auditMetadata", map[string]any{
		"operation":      "reset_to_defaults",
		"resourceType":   "dimensions",
		"deletedCount":   countBefore,
		"restoredCount":  countAfter,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Dimensions reset to defaults successfully"})
}

// ResetQuestionsHandler resets quiz questions to default values
func ResetQuestionsHandler(c *gin.Context) {
	db := database.GetDB()

	var countBefore int64
	db.Model(&database.QuizQuestionDB{}).Count(&countBefore)

	if err := database.ResetQuestions(db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset questions: " + err.Error()})
		return
	}

	var countAfter int64
	db.Model(&database.QuizQuestionDB{}).Count(&countAfter)

	c.Set("auditMetadata", map[string]any{
		"operation":      "reset_to_defaults",
		"resourceType":   "questions",
		"deletedCount":   countBefore,
		"restoredCount":  countAfter,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Questions reset to defaults successfully"})
}

// ResetGlowtypesHandler resets glowtypes to default values
func ResetGlowtypesHandler(c *gin.Context) {
	db := database.GetDB()

	var countBefore int64
	db.Model(&database.GlowtypeDB{}).Count(&countBefore)

	if err := database.ResetGlowtypes(db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset glowtypes: " + err.Error()})
		return
	}

	var countAfter int64
	db.Model(&database.GlowtypeDB{}).Count(&countAfter)

	c.Set("auditMetadata", map[string]any{
		"operation":      "reset_to_defaults",
		"resourceType":   "glowtypes",
		"deletedCount":   countBefore,
		"restoredCount":  countAfter,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Glowtypes reset to defaults successfully"})
}

// ResetRulesHandler resets scoring rules to default values
func ResetRulesHandler(c *gin.Context) {
	db := database.GetDB()

	var countBefore int64
	db.Model(&database.ScoringRuleDB{}).Count(&countBefore)

	if err := database.ResetRules(db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset rules: " + err.Error()})
		return
	}

	var countAfter int64
	db.Model(&database.ScoringRuleDB{}).Count(&countAfter)

	c.Set("auditMetadata", map[string]any{
		"operation":      "reset_to_defaults",
		"resourceType":   "scoring_rules",
		"deletedCount":   countBefore,
		"restoredCount":  countAfter,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Scoring rules reset to defaults successfully"})
}

// ResetPromptsHandler resets AI prompts to default values
func ResetPromptsHandler(c *gin.Context) {
	db := database.GetDB()

	var countBefore int64
	db.Model(&database.AIPromptDB{}).Count(&countBefore)

	if err := database.ResetPrompts(db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset prompts: " + err.Error()})
		return
	}

	var countAfter int64
	db.Model(&database.AIPromptDB{}).Count(&countAfter)

	c.Set("auditMetadata", map[string]any{
		"operation":      "reset_to_defaults",
		"resourceType":   "ai_prompts",
		"deletedCount":   countBefore,
		"restoredCount":  countAfter,
	})
	c.JSON(http.StatusOK, gin.H{"message": "AI prompts reset to defaults successfully"})
}

// ResetGlowpediaHandler resets Glowpedia chapters and glow sticks to default values
func ResetGlowpediaHandler(c *gin.Context) {
	db := database.GetDB()

	var chaptersBefore, sticksBefore int64
	db.Model(&database.BookChapterDB{}).Count(&chaptersBefore)
	db.Model(&database.GlowStickDB{}).Count(&sticksBefore)

	if err := database.ResetGlowpedia(db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset Glowpedia: " + err.Error()})
		return
	}

	var chaptersAfter, sticksAfter int64
	db.Model(&database.BookChapterDB{}).Count(&chaptersAfter)
	db.Model(&database.GlowStickDB{}).Count(&sticksAfter)

	c.Set("auditMetadata", map[string]any{
		"operation":             "reset_to_defaults",
		"resourceType":          "glowpedia",
		"deletedChapters":       chaptersBefore,
		"deletedSticks":         sticksBefore,
		"restoredChapters":      chaptersAfter,
		"restoredSticks":        sticksAfter,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Glowpedia reset to defaults successfully"})
}

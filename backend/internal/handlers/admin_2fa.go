package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"image/png"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/services"
	"gorm.io/gorm"
)

// ============ 2FA Setup Handlers ============

// Setup2FAHandler starts 2FA setup and returns QR code data
// POST /admin/2fa/setup
func Setup2FAHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if !services.IsTOTPEncryptionKeyConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "2FA is not configured on this server"})
		return
	}

	var req struct {
		CurrentCode string `json:"currentCode"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Reload user to get latest state
	var user database.AdminUser
	if err := database.GetDB().First(&user, admin.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return
	}

	// Rate limit 2FA-sensitive actions
	locked, unlockAt, err := services.IsLoginLocked(database.GetDB(), user.Username, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "2FA verification check failed"})
		return
	}
	if locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":    "Too many attempts. Please try again later.",
			"unlockAt": unlockAt,
		})
		return
	}

	// If user already has 2FA enabled and verified, require proof of possession before rotating secret
	// Note: We only check TwoFactorEnabled, not TwoFactorSecret, because a user might have
	// an unverified secret from a failed setup attempt. In that case, they should be able
	// to start fresh without needing a code they never successfully set up.
	if user.TwoFactorEnabled {
		if strings.TrimSpace(req.CurrentCode) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current 2FA code is required to change 2FA setup"})
			return
		}

		secret, err := services.DecryptTOTPSecret(user.TwoFactorSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify existing 2FA"})
			return
		}

		valid := services.ValidateTOTP(secret, req.CurrentCode)
		if !valid {
			used, useErr := services.UseRecoveryCode(database.GetDB(), user.ID, req.CurrentCode)
			if useErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify existing 2FA"})
				return
			}
			valid = used
		}

		if !valid {
			_ = services.RegisterLoginFailure(database.GetDB(), user.Username, c.ClientIP())
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid current 2FA code"})
			return
		}

		_ = services.RegisterLoginSuccess(database.GetDB(), user.Username, c.ClientIP())
	}

	// Generate new TOTP secret
	key, err := services.GenerateTOTPSecret(user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate 2FA secret"})
		return
	}

	// Encrypt and store temporarily (not yet verified)
	encrypted, err := services.EncryptTOTPSecret(key.Secret())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt 2FA secret"})
		return
	}

	// Store encrypted secret (but don't enable 2FA yet until verified)
	if err := database.GetDB().Model(&user).Updates(map[string]any{
		"two_factor_secret": encrypted,
		"token_version":     gorm.Expr("token_version + 1"),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save 2FA secret"})
		return
	}

	// Generate QR code URL
	qrURL := key.URL()

	c.JSON(http.StatusOK, gin.H{
		"secret":  key.Secret(),
		"qrCode":  qrURL,
		"issuer":  key.Issuer(),
		"account": user.Username,
	})
}

// Verify2FAHandler verifies initial TOTP code to complete 2FA setup
// POST /admin/2fa/verify
func Verify2FAHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Reload user to get latest secret
	var user database.AdminUser
	if err := database.GetDB().First(&user, admin.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return
	}

	locked, unlockAt, err := services.IsLoginLocked(database.GetDB(), user.Username, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "2FA verification check failed"})
		return
	}
	if locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":    "Too many attempts. Please try again later.",
			"unlockAt": unlockAt,
		})
		return
	}

	if user.TwoFactorSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA setup not started. Please call /2fa/setup first."})
		return
	}

	// Decrypt secret
	secret, err := services.DecryptTOTPSecret(user.TwoFactorSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt 2FA secret"})
		return
	}

	// Validate TOTP code
	if !services.ValidateTOTP(secret, req.Code) {
		_ = services.RegisterLoginFailure(database.GetDB(), user.Username, c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code. Please try again."})
		return
	}
	_ = services.RegisterLoginSuccess(database.GetDB(), user.Username, c.ClientIP())

	// Generate recovery codes
	plainCodes, hashedCodes, err := services.GenerateRecoveryCodes(10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate recovery codes"})
		return
	}

	// Save recovery codes
	if err := services.SaveRecoveryCodes(database.GetDB(), user.ID, hashedCodes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recovery codes"})
		return
	}

	// Enable 2FA
	now := time.Now()
	if err := database.GetDB().Model(&user).Updates(map[string]interface{}{
		"two_factor_enabled":     true,
		"two_factor_verified_at": now,
		"token_version":          gorm.Expr("token_version + 1"),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable 2FA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"recoveryCodes": plainCodes,
		"message":       "2FA enabled successfully. Save your recovery codes in a safe place.",
	})
}

// Disable2FAHandler disables 2FA (requires current TOTP or recovery code)
// DELETE /admin/2fa
func Disable2FAHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Check if 2FA is forced for this user
	if admin.TwoFactorRequired || services.IsForceAdmin2FAEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "2FA is required and cannot be disabled"})
		return
	}

	// Reload user
	var user database.AdminUser
	if err := database.GetDB().First(&user, admin.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return
	}

	locked, unlockAt, err := services.IsLoginLocked(database.GetDB(), user.Username, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "2FA verification check failed"})
		return
	}
	if locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":    "Too many attempts. Please try again later.",
			"unlockAt": unlockAt,
		})
		return
	}

	if !user.TwoFactorEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA is not enabled"})
		return
	}

	// Validate code (TOTP or recovery)
	valid := false

	// Try TOTP first
	if user.TwoFactorSecret != "" {
		secret, err := services.DecryptTOTPSecret(user.TwoFactorSecret)
		if err == nil && services.ValidateTOTP(secret, req.Code) {
			valid = true
		}
	}

	// Try recovery code
	if !valid {
		used, err := services.UseRecoveryCode(database.GetDB(), user.ID, req.Code)
		if err == nil && used {
			valid = true
		}
	}

	if !valid {
		_ = services.RegisterLoginFailure(database.GetDB(), user.Username, c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code"})
		return
	}
	_ = services.RegisterLoginSuccess(database.GetDB(), user.Username, c.ClientIP())

	// Reset 2FA
	if err := services.Reset2FA(database.GetDB(), user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disable 2FA"})
		return
	}
	_ = database.GetDB().Model(&user).Update("token_version", gorm.Expr("token_version + 1"))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "2FA disabled successfully",
	})
}

// Get2FAStatusHandler returns current 2FA status
// GET /admin/2fa/status
func Get2FAStatusHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Reload user
	var user database.AdminUser
	if err := database.GetDB().First(&user, admin.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return
	}

	// Count unused recovery codes
	recoveryCodesLeft, _ := services.CountUnusedRecoveryCodes(database.GetDB(), user.ID)

	c.JSON(http.StatusOK, gin.H{
		"enabled":           user.TwoFactorEnabled,
		"verifiedAt":        user.TwoFactorVerifiedAt,
		"requiredByAdmin":   user.TwoFactorRequired,
		"requiredBySystem":  services.IsForceAdmin2FAEnabled(),
		"recoveryCodesLeft": recoveryCodesLeft,
		"configured":        services.IsTOTPEncryptionKeyConfigured(),
	})
}

// RegenerateRecoveryCodesHandler regenerates recovery codes
// POST /admin/2fa/recovery/regenerate
func RegenerateRecoveryCodesHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Reload user
	var user database.AdminUser
	if err := database.GetDB().First(&user, admin.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return
	}

	locked, unlockAt, err := services.IsLoginLocked(database.GetDB(), user.Username, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "2FA verification check failed"})
		return
	}
	if locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":    "Too many attempts. Please try again later.",
			"unlockAt": unlockAt,
		})
		return
	}

	if !user.TwoFactorEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA is not enabled"})
		return
	}

	// Validate TOTP code
	secret, err := services.DecryptTOTPSecret(user.TwoFactorSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt 2FA secret"})
		return
	}

	if !services.ValidateTOTP(secret, req.Code) {
		_ = services.RegisterLoginFailure(database.GetDB(), user.Username, c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code"})
		return
	}
	_ = services.RegisterLoginSuccess(database.GetDB(), user.Username, c.ClientIP())

	// Generate new recovery codes
	plainCodes, hashedCodes, err := services.GenerateRecoveryCodes(10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate recovery codes"})
		return
	}

	// Save recovery codes
	if err := services.SaveRecoveryCodes(database.GetDB(), user.ID, hashedCodes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recovery codes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"recoveryCodes": plainCodes,
		"message":       "Recovery codes regenerated. Save them in a safe place.",
	})
}

// ============ 2FA Authentication Handler ============

// Authenticate2FAHandler completes login with 2FA code
// POST /admin/2fa/authenticate
func Authenticate2FAHandler(c *gin.Context) {
	var req struct {
		TwoFAToken  string `json:"twoFAToken" binding:"required"`
		Code        string `json:"code" binding:"required"`
		TrustDevice bool   `json:"trustDevice"`
		DeviceName  string `json:"deviceName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate 2FA token
	claims, err := services.Validate2FAToken(req.TwoFAToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired 2FA token"})
		return
	}

	// Load user
	var user database.AdminUser
	if err := database.GetDB().First(&user, claims.AdminID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	locked, unlockAt, err := services.IsLoginLocked(database.GetDB(), user.Username, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "2FA verification check failed"})
		return
	}
	if locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":    "Too many attempts. Please try again later.",
			"unlockAt": unlockAt,
		})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is disabled"})
		return
	}

	// Validate code (TOTP or recovery)
	valid := false
	usedRecoveryCode := false

	// Try TOTP first
	if user.TwoFactorSecret != "" {
		secret, err := services.DecryptTOTPSecret(user.TwoFactorSecret)
		if err == nil && services.ValidateTOTP(secret, req.Code) {
			valid = true
		}
	}

	// Try recovery code
	if !valid {
		used, err := services.UseRecoveryCode(database.GetDB(), user.ID, req.Code)
		if err == nil && used {
			valid = true
			usedRecoveryCode = true
		}
	}

	if !valid {
		_ = services.RegisterLoginFailure(database.GetDB(), user.Username, c.ClientIP())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid verification code"})
		return
	}

	// Generate full token
	token, exp, err := services.GenerateAdminToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Update login metadata
	clientIP := c.ClientIP()
	now := time.Now()
	database.GetDB().Model(&user).Updates(map[string]any{
		"last_login_at": now,
		"last_login_ip": clientIP,
	})
	_ = services.RegisterLoginSuccess(database.GetDB(), user.Username, clientIP)

	// Handle trusted device
	var deviceToken string
	if req.TrustDevice {
		deviceToken, err = services.GenerateTrustedDeviceToken()
		if err == nil {
			deviceName := req.DeviceName
			if deviceName == "" {
				deviceName = "Trusted Device"
			}
			if err := services.CreateTrustedDevice(database.GetDB(), user.ID, deviceToken, deviceName, c.Request.UserAgent(), clientIP); err != nil {
				log.Printf("failed to create trusted device: %v", err)
			}
		}
	}

	// Build response
	var customPerms []string
	if len(user.Permissions) > 0 {
		_ = json.Unmarshal(user.Permissions, &customPerms)
	}

	response := gin.H{
		"success":   true,
		"token":     token,
		"expiresAt": exp.Unix(),
		"user": gin.H{
			"id":                   user.ID,
			"username":             user.Username,
			"role":                 user.Role,
			"permissions":          customPerms,
			"effectivePermissions": getUserPermissions(user),
			"lastLoginAt":          now,
			"lastLoginIp":          clientIP,
			"twoFactorEnabled":     user.TwoFactorEnabled,
		},
	}

	if deviceToken != "" {
		response["deviceToken"] = deviceToken
	}

	if usedRecoveryCode {
		recoveryCodesLeft, _ := services.CountUnusedRecoveryCodes(database.GetDB(), user.ID)
		response["recoveryCodesLeft"] = recoveryCodesLeft
		response["usedRecoveryCode"] = true
	}

	c.JSON(http.StatusOK, response)
}

// ============ Trusted Device Handlers ============

// ListTrustedDevicesHandler returns all trusted devices
// GET /admin/2fa/devices
func ListTrustedDevicesHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	devices, err := services.ListTrustedDevices(database.GetDB(), admin.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list devices"})
		return
	}

	// Get current device token from cookie/header to mark current device
	currentToken := c.GetHeader("X-Device-Token")
	currentTokenHash := ""
	if currentToken != "" {
		currentTokenHash = services.HashDeviceToken(currentToken)
	}

	result := make([]gin.H, len(devices))
	for i, device := range devices {
		result[i] = gin.H{
			"id":         device.ID,
			"deviceName": device.DeviceName,
			"userAgent":  device.UserAgent,
			"ip":         device.IP,
			"lastUsedAt": device.LastUsedAt,
			"expiresAt":  device.ExpiresAt,
			"createdAt":  device.CreatedAt,
			"isCurrent":  device.DeviceToken == currentTokenHash,
		}
	}

	c.JSON(http.StatusOK, result)
}

// RevokeTrustedDeviceHandler revokes a single trusted device
// DELETE /admin/2fa/devices/:id
func RevokeTrustedDeviceHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid device ID"})
		return
	}

	if err := services.RevokeTrustedDevice(database.GetDB(), admin.ID, uint(deviceID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RevokeAllTrustedDevicesHandler revokes all trusted devices
// DELETE /admin/2fa/devices
func RevokeAllTrustedDevicesHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := services.RevokeAllTrustedDevices(database.GetDB(), admin.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke devices"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============ Superadmin 2FA Management ============

// ManageUser2FAHandler allows superadmin to force or reset user's 2FA
// PUT /admin/users/:id/2fa
func ManageUser2FAHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok || admin.Role != database.AdminRoleSuper {
		c.JSON(http.StatusForbidden, gin.H{"error": "Superadmin access required"})
		return
	}

	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		ForceEnabled *bool `json:"forceEnabled"`
		Reset        bool  `json:"reset"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Load target user
	var user database.AdminUser
	if err := database.GetDB().First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Handle reset
	if req.Reset {
		if err := services.Reset2FA(database.GetDB(), user.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset 2FA"})
			return
		}
	}

	// Handle force enabled
	if req.ForceEnabled != nil {
		if err := database.GetDB().Model(&user).Update("two_factor_required", *req.ForceEnabled).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update 2FA requirement"})
			return
		}
	}

	// Reload and return updated user
	database.GetDB().First(&user, userID)

	var customPerms []string
	if len(user.Permissions) > 0 {
		_ = json.Unmarshal(user.Permissions, &customPerms)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                   user.ID,
		"username":             user.Username,
		"role":                 user.Role,
		"permissions":          customPerms,
		"effectivePermissions": getUserPermissions(user),
		"isActive":             user.IsActive,
		"twoFactorEnabled":     user.TwoFactorEnabled,
		"twoFactorRequired":    user.TwoFactorRequired,
		"twoFactorVerifiedAt":  user.TwoFactorVerifiedAt,
		"twoFactorPending":     user.TwoFactorSecret != "" && !user.TwoFactorEnabled,
	})
}

// ============ Change Password Handler ============

// ChangePasswordHandler allows admin to change their own password
// PUT /admin/me/password
func ChangePasswordHandler(c *gin.Context) {
	admin, ok := getAdminFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=8"`
		ConfirmPassword string `json:"confirmPassword" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request. Password must be at least 8 characters."})
		return
	}

	// Verify passwords match
	if req.NewPassword != req.ConfirmPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password and confirmation do not match"})
		return
	}

	// Reload user to get current password hash
	var user database.AdminUser
	if err := database.GetDB().First(&user, admin.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return
	}

	// Verify current password
	if !services.CheckPassword(user.PasswordHash, req.CurrentPassword) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
		return
	}

	// Verify new password is different
	if services.CheckPassword(user.PasswordHash, req.NewPassword) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be different from current password"})
		return
	}

	// Hash new password
	newHash, err := services.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Update password
	if err := database.GetDB().Model(&user).Updates(map[string]any{
		"password_hash": newHash,
		"token_version": gorm.Expr("token_version + 1"),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password changed successfully",
	})
}

// ============ Helper for generating QR code image ============

// GenerateQRCodeImage generates a PNG QR code for TOTP setup
func GenerateQRCodeImage(key *otp.Key) ([]byte, error) {
	img, err := key.Image(200, 200)
	if err != nil {
		return nil, err
	}

	// Encode as PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// GetQRCodeDataURL generates a data URL for QR code
func GetQRCodeDataURL(key *otp.Key) (string, error) {
	pngData, err := GenerateQRCodeImage(key)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngData), nil
}

package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/soaringjerry/glowtype/internal/database"
)

const (
	totpIssuer               = "Glowtype Admin"
	totpPeriod               = 30 // seconds
	totpDigits               = 6
	totpSkew                 = 1  // allow ±1 time window (90 seconds total)
	recoveryCodeBytes        = 6  // 6 bytes = 48 bits entropy (was 4 bytes = 32 bits)
	defaultRecoveryCodeCount = 10
	defaultTrustedDeviceDays = 7
	twoFATokenTTL            = 5 * time.Minute
	totpEncryptionKeyEnvHint = "TOTP_ENCRYPTION_KEY"
	forceAdmin2FAEnvHint     = "FORCE_ADMIN_2FA"
	trustedDeviceDaysEnvHint = "TRUSTED_DEVICE_DAYS"
	maxDeviceNameLength      = 255
	maxUserAgentLength       = 1024
)

var (
	totpEncryptionKey     []byte
	totpEncryptionKeyOnce sync.Once
	forceAdmin2FA         bool
	forceAdmin2FAOnce     sync.Once
	trustedDeviceDays     int
	trustedDeviceDaysOnce sync.Once
)

// TwoFATokenClaims defines temporary 2FA pending token data
type TwoFATokenClaims struct {
	AdminID   uint   `json:"adminId"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	Purpose   string `json:"purpose"` // "2fa_pending"
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

// GenerateTOTPSecret creates a new TOTP secret for user enrollment
func GenerateTOTPSecret(username string) (*otp.Key, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      totpIssuer,
		AccountName: username,
		Period:      totpPeriod,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA256, // SHA-256 for better security
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate TOTP secret: %w", err)
	}
	return key, nil
}

// ValidateTOTP validates a 6-digit TOTP code against a secret
// Uses custom validation with time window skew to handle network latency
func ValidateTOTP(secret, code string) bool {
	valid, err := totp.ValidateCustom(code, secret, time.Now(), totp.ValidateOpts{
		Period:    totpPeriod,
		Skew:      totpSkew, // allows ±1 time window (90 seconds total)
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA256, // SHA-256 for better security
	})
	if err != nil {
		return false
	}
	return valid
}

// EncryptTOTPSecret encrypts the TOTP secret before DB storage using AES-256-GCM
func EncryptTOTPSecret(secret string) (string, error) {
	key := getTOTPEncryptionKey()
	if len(key) == 0 {
		return "", errors.New("TOTP encryption key not configured")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(secret), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptTOTPSecret decrypts the TOTP secret from DB
func DecryptTOTPSecret(encrypted string) (string, error) {
	key := getTOTPEncryptionKey()
	if len(key) == 0 {
		return "", errors.New("TOTP encryption key not configured")
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// GenerateRecoveryCodes generates N one-time recovery codes
// Returns (plainCodes for display, hashedCodes for storage)
// Each code has 48 bits of entropy (6 bytes), formatted as 12 hex characters
func GenerateRecoveryCodes(count int) ([]string, []string, error) {
	if count <= 0 {
		count = defaultRecoveryCodeCount
	}

	plainCodes := make([]string, count)
	hashedCodes := make([]string, count)

	for i := 0; i < count; i++ {
		// Generate random bytes (6 bytes = 48 bits entropy)
		bytes := make([]byte, recoveryCodeBytes)
		if _, err := rand.Read(bytes); err != nil {
			return nil, nil, fmt.Errorf("failed to generate random bytes: %w", err)
		}
		// Format as uppercase hex (12 characters)
		code := strings.ToUpper(hex.EncodeToString(bytes))
		plainCodes[i] = code

		// Hash for storage
		hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to hash recovery code: %w", err)
		}
		hashedCodes[i] = string(hash)
	}

	return plainCodes, hashedCodes, nil
}

// ValidateRecoveryCode checks if a recovery code is valid
func ValidateRecoveryCode(inputCode, hashedCode string) bool {
	// Normalize input (uppercase, remove dashes/spaces)
	normalized := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(inputCode, "-", ""), " ", ""))
	return bcrypt.CompareHashAndPassword([]byte(hashedCode), []byte(normalized)) == nil
}

// GenerateTrustedDeviceToken creates a cryptographically secure device token
func GenerateTrustedDeviceToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate device token: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// HashDeviceToken hashes the device token for storage
func HashDeviceToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// SaveRecoveryCodes stores recovery codes in the database
func SaveRecoveryCodes(db *gorm.DB, adminID uint, hashedCodes []string) error {
	// Delete existing recovery codes
	if err := db.Where("admin_id = ?", adminID).Delete(&database.AdminRecoveryCode{}).Error; err != nil {
		return fmt.Errorf("failed to delete existing recovery codes: %w", err)
	}

	// Insert new recovery codes
	for _, hash := range hashedCodes {
		code := database.AdminRecoveryCode{
			AdminID:  adminID,
			CodeHash: hash,
		}
		if err := db.Create(&code).Error; err != nil {
			return fmt.Errorf("failed to save recovery code: %w", err)
		}
	}

	return nil
}

// UseRecoveryCode validates and marks a recovery code as used
// Returns true if the code was valid and successfully marked as used
func UseRecoveryCode(db *gorm.DB, adminID uint, inputCode string) (bool, error) {
	var codes []database.AdminRecoveryCode
	if err := db.Where("admin_id = ? AND used_at IS NULL", adminID).Find(&codes).Error; err != nil {
		return false, fmt.Errorf("failed to fetch recovery codes: %w", err)
	}

	for _, code := range codes {
		if ValidateRecoveryCode(inputCode, code.CodeHash) {
			now := time.Now()
			code.UsedAt = &now
			if err := db.Save(&code).Error; err != nil {
				return false, fmt.Errorf("failed to mark recovery code as used: %w", err)
			}
			return true, nil
		}
	}

	return false, nil
}

// CountUnusedRecoveryCodes returns the count of unused recovery codes for an admin
func CountUnusedRecoveryCodes(db *gorm.DB, adminID uint) (int, error) {
	var count int64
	if err := db.Model(&database.AdminRecoveryCode{}).Where("admin_id = ? AND used_at IS NULL", adminID).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

// SanitizeDeviceName validates and truncates device name
func SanitizeDeviceName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Trusted Device"
	}
	if len(name) > maxDeviceNameLength {
		return name[:maxDeviceNameLength]
	}
	return name
}

// SanitizeUserAgent truncates user agent to prevent DB overflow
func SanitizeUserAgent(ua string) string {
	if len(ua) > maxUserAgentLength {
		return ua[:maxUserAgentLength]
	}
	return ua
}

// CreateTrustedDevice creates a new trusted device record
func CreateTrustedDevice(db *gorm.DB, adminID uint, deviceToken, deviceName, userAgent, ip string) error {
	hashedToken := HashDeviceToken(deviceToken)
	expiresAt := time.Now().Add(time.Duration(GetTrustedDeviceDays()) * 24 * time.Hour)

	device := database.AdminTrustedDevice{
		AdminID:     adminID,
		DeviceToken: hashedToken,
		DeviceName:  SanitizeDeviceName(deviceName),
		UserAgent:   SanitizeUserAgent(userAgent),
		IP:          ip,
		ExpiresAt:   expiresAt,
	}

	return db.Create(&device).Error
}

// ValidateTrustedDevice checks if a device token is valid for the admin
func ValidateTrustedDevice(db *gorm.DB, adminID uint, deviceToken string) (bool, error) {
	hashedToken := HashDeviceToken(deviceToken)

	var device database.AdminTrustedDevice
	err := db.Where("admin_id = ? AND device_token = ? AND expires_at > ?", adminID, hashedToken, time.Now()).First(&device).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	// Update last used time
	now := time.Now()
	device.LastUsedAt = &now
	db.Save(&device)

	return true, nil
}

// ListTrustedDevices returns all trusted devices for an admin
func ListTrustedDevices(db *gorm.DB, adminID uint) ([]database.AdminTrustedDevice, error) {
	var devices []database.AdminTrustedDevice
	if err := db.Where("admin_id = ? AND expires_at > ?", adminID, time.Now()).Order("created_at DESC").Find(&devices).Error; err != nil {
		return nil, err
	}
	return devices, nil
}

// RevokeTrustedDevice removes a trusted device
func RevokeTrustedDevice(db *gorm.DB, adminID uint, deviceID uint) error {
	return db.Where("id = ? AND admin_id = ?", deviceID, adminID).Delete(&database.AdminTrustedDevice{}).Error
}

// RevokeAllTrustedDevices removes all trusted devices for an admin
func RevokeAllTrustedDevices(db *gorm.DB, adminID uint) error {
	return db.Where("admin_id = ?", adminID).Delete(&database.AdminTrustedDevice{}).Error
}

// IsForceAdmin2FAEnabled returns whether global 2FA enforcement is enabled via env
func IsForceAdmin2FAEnabled() bool {
	forceAdmin2FAOnce.Do(func() {
		v := strings.ToLower(strings.TrimSpace(os.Getenv(forceAdmin2FAEnvHint)))
		forceAdmin2FA = v == "1" || v == "true" || v == "yes"
		if forceAdmin2FA {
			log.Printf("[2FA] Global force 2FA is enabled via %s", forceAdmin2FAEnvHint)
		}
	})
	return forceAdmin2FA
}

// GetTrustedDeviceDays returns the number of days a device stays trusted
func GetTrustedDeviceDays() int {
	trustedDeviceDaysOnce.Do(func() {
		trustedDeviceDays = defaultTrustedDeviceDays
		if v := os.Getenv(trustedDeviceDaysEnvHint); v != "" {
			var days int
			if _, err := fmt.Sscanf(v, "%d", &days); err == nil && days > 0 {
				trustedDeviceDays = days
			}
		}
	})
	return trustedDeviceDays
}

// IsTOTPEncryptionKeyConfigured checks if TOTP encryption key is set
func IsTOTPEncryptionKeyConfigured() bool {
	key := getTOTPEncryptionKey()
	return len(key) == 32
}

// getTOTPEncryptionKey returns the 32-byte AES key for encrypting TOTP secrets
// If 2FA is expected (key is set but invalid), this will panic at startup
func getTOTPEncryptionKey() []byte {
	totpEncryptionKeyOnce.Do(func() {
		secret := strings.TrimSpace(os.Getenv(totpEncryptionKeyEnvHint))
		if secret == "" {
			// Key not set - 2FA will be unavailable (graceful degradation)
			log.Printf("[2FA] Info: %s not set. 2FA features will be unavailable.", totpEncryptionKeyEnvHint)
			return
		}
		// Key is set but invalid - fail fast to prevent misconfiguration
		if len(secret) != 32 {
			log.Fatalf("[2FA] FATAL: %s must be exactly 32 characters for AES-256. Got %d chars. "+
				"Generate a secure key with: openssl rand -hex 16", totpEncryptionKeyEnvHint, len(secret))
		}
		totpEncryptionKey = []byte(secret)
		log.Printf("[2FA] TOTP encryption key configured successfully")
	})
	return totpEncryptionKey
}

// Generate2FAToken generates a temporary token for 2FA pending state
func Generate2FAToken(user database.AdminUser) (string, time.Time, error) {
	exp := time.Now().Add(twoFATokenTTL)
	claims := TwoFATokenClaims{
		AdminID:   user.ID,
		Username:  user.Username,
		Role:      user.Role,
		Purpose:   "2fa_pending",
		IssuedAt:  time.Now().Unix(),
		ExpiresAt: exp.Unix(),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", time.Time{}, err
	}

	sig := hmac.New(sha256.New, getAdminTokenSecret())
	if _, err := sig.Write(payload); err != nil {
		return "", time.Time{}, err
	}
	token := fmt.Sprintf(
		"2fa.%s.%s",
		base64.RawURLEncoding.EncodeToString(payload),
		base64.RawURLEncoding.EncodeToString(sig.Sum(nil)),
	)
	return token, exp, nil
}

// Validate2FAToken validates a 2FA pending token
func Validate2FAToken(token string) (*TwoFATokenClaims, error) {
	if !strings.HasPrefix(token, "2fa.") {
		return nil, errors.New("invalid 2FA token format")
	}

	parts := strings.Split(token[4:], ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid 2FA token")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("invalid 2FA token payload")
	}

	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid 2FA token signature")
	}

	expected := hmac.New(sha256.New, getAdminTokenSecret())
	expected.Write(payload)
	if !hmac.Equal(sigBytes, expected.Sum(nil)) {
		return nil, errors.New("invalid 2FA token signature")
	}

	var claims TwoFATokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, errors.New("invalid 2FA token payload")
	}

	if claims.Purpose != "2fa_pending" {
		return nil, errors.New("invalid 2FA token purpose")
	}

	if time.Unix(claims.ExpiresAt, 0).Before(time.Now()) {
		return nil, errors.New("2FA token expired")
	}

	return &claims, nil
}

// Reset2FA clears 2FA settings for an admin user
func Reset2FA(db *gorm.DB, adminID uint) error {
	// Clear 2FA fields
	if err := db.Model(&database.AdminUser{}).Where("id = ?", adminID).Updates(map[string]interface{}{
		"two_factor_enabled":     false,
		"two_factor_secret":      "",
		"two_factor_verified_at": nil,
		"token_version":          gorm.Expr("token_version + 1"),
	}).Error; err != nil {
		return fmt.Errorf("failed to reset 2FA: %w", err)
	}

	// Delete recovery codes
	if err := db.Where("admin_id = ?", adminID).Delete(&database.AdminRecoveryCode{}).Error; err != nil {
		return fmt.Errorf("failed to delete recovery codes: %w", err)
	}

	// Delete trusted devices
	if err := db.Where("admin_id = ?", adminID).Delete(&database.AdminTrustedDevice{}).Error; err != nil {
		return fmt.Errorf("failed to delete trusted devices: %w", err)
	}

	return nil
}

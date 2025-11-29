package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/soaringjerry/glowtype/internal/database"
)

const (
	adminTokenTTL        = 24 * time.Hour
	maxLoginAttempts     = 5
	loginWindow          = 15 * time.Minute
	lockDuration         = 15 * time.Minute
	adminTokenSecretHint = "ADMIN_JWT_SECRET"
)

var (
	adminTokenSecret []byte
	adminSecretOnce  sync.Once
)

// AdminTokenClaims defines signed admin session data
type AdminTokenClaims struct {
	AdminID   uint   `json:"adminId"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	Version   int    `json:"ver"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func GenerateAdminToken(user database.AdminUser) (string, time.Time, error) {
	exp := time.Now().Add(adminTokenTTL)
	version := user.TokenVersion
	if version <= 0 {
		version = 1
	}
	claims := AdminTokenClaims{
		AdminID:   user.ID,
		Username:  user.Username,
		Role:      user.Role,
		Version:   version,
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
		"%s.%s",
		base64.RawURLEncoding.EncodeToString(payload),
		base64.RawURLEncoding.EncodeToString(sig.Sum(nil)),
	)
	return token, exp, nil
}

func ValidateAdminToken(token string) (*AdminTokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid token")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("invalid token payload")
	}

	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid token signature")
	}

	expected := hmac.New(sha256.New, getAdminTokenSecret())
	expected.Write(payload)
	if !hmac.Equal(sigBytes, expected.Sum(nil)) {
		return nil, errors.New("invalid token signature")
	}

	var claims AdminTokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, errors.New("invalid token payload")
	}

	if claims.Version <= 0 {
		claims.Version = 1
	}

	if time.Unix(claims.ExpiresAt, 0).Before(time.Now()) {
		return nil, errors.New("token expired")
	}

	return &claims, nil
}

// IsLoginLocked returns whether the username/IP combination is temporarily locked.
func IsLoginLocked(db *gorm.DB, username, ip string) (bool, time.Time, error) {
	if isRateLimitDisabled() {
		return false, time.Time{}, nil
	}

	attempt, err := loadLoginAttempt(db, username, ip)
	if err != nil || attempt == nil {
		return false, time.Time{}, err
	}

	now := time.Now()
	if attempt.LockedUntil != nil {
		if attempt.LockedUntil.After(now) {
			return true, *attempt.LockedUntil, nil
		}

		// Lock expired; clear it
		attempt.LockedUntil = nil
		attempt.Attempts = 0
		attempt.LastAttempt = nil
		return false, time.Time{}, db.Save(attempt).Error
	}

	return false, time.Time{}, nil
}

// RegisterLoginFailure increments the attempt counter and locks if necessary.
func RegisterLoginFailure(db *gorm.DB, username, ip string) error {
	if isRateLimitDisabled() {
		return nil
	}

	attempt, err := loadLoginAttempt(db, username, ip)
	if err != nil {
		return err
	}

	now := time.Now()
	if attempt.LastAttempt == nil || now.Sub(*attempt.LastAttempt) > loginWindow {
		attempt.Attempts = 1
	} else {
		attempt.Attempts++
	}
	attempt.LastAttempt = &now

	if attempt.Attempts >= maxLoginAttempts {
		lockUntil := now.Add(lockDuration)
		attempt.LockedUntil = &lockUntil
		attempt.Attempts = 0
	}

	if attempt.ID == 0 {
		return db.Create(attempt).Error
	}
	return db.Save(attempt).Error
}

// RegisterLoginSuccess clears the attempt counter on successful login.
func RegisterLoginSuccess(db *gorm.DB, username, ip string) error {
	if isRateLimitDisabled() {
		return nil
	}
	return db.Where("username = ? AND ip = ?", username, ip).Delete(&database.AdminLoginAttempt{}).Error
}

func loadLoginAttempt(db *gorm.DB, username, ip string) (*database.AdminLoginAttempt, error) {
	var attempt database.AdminLoginAttempt
	err := db.Where("username = ? AND ip = ?", username, ip).First(&attempt).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &database.AdminLoginAttempt{
			Username: username,
			IP:       ip,
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return &attempt, nil
}

func getAdminTokenSecret() []byte {
	adminSecretOnce.Do(func() {
		secret := strings.TrimSpace(os.Getenv(adminTokenSecretHint))
		if secret == "" {
			log.Fatalf("%s must be set to a strong secret", adminTokenSecretHint)
		}
		adminTokenSecret = []byte(secret)
	})
	return adminTokenSecret
}

func isRateLimitDisabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_LOGIN_RATE_LIMIT_DISABLE")))
	return v == "1" || v == "true" || v == "yes"
}

// IsRateLimitDisabled is exposed for handlers to check rate limit status.
func IsRateLimitDisabled() bool {
	return isRateLimitDisabled()
}

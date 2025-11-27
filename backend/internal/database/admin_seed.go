package database

import (
	"errors"
	"log"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ensureDefaultSuperAdmin creates a bootstrap super admin account when the table is empty.
// Password is sourced from ADMIN_SUPER_PASSWORD (preferred) or ADMIN_PASSWORD for backward compatibility.
func ensureDefaultSuperAdmin(db *gorm.DB) {
	var count int64
	if err := db.Model(&AdminUser{}).Count(&count).Error; err != nil {
		log.Printf("failed to count admin users: %v", err)
		return
	}
	if count == 0 {
		username := getEnv("ADMIN_SUPER_USERNAME", getEnv("ADMIN_USERNAME", "superadmin"))
		password, err := getSeedPassword()
		if err != nil {
			log.Fatalf("super admin bootstrap requires ADMIN_SUPER_PASSWORD: %v", err)
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("failed to hash default super admin password: %v", err)
			return
		}

		user := AdminUser{
			Username:     username,
			PasswordHash: string(hash),
			Role:         AdminRoleSuper,
			IsActive:     true,
		}

		if err := db.Create(&user).Error; err != nil {
			log.Printf("failed to create default super admin: %v", err)
			return
		}

		log.Printf("Default super admin created with username '%s'. Please rotate ADMIN_SUPER_PASSWORD immediately.", username)
	}

	rotateSuperAdminPassword(db)
}

func rotateSuperAdminPassword(db *gorm.DB) {
	flag := os.Getenv("ADMIN_SUPER_PASSWORD_ROTATE")
	if flag == "" {
		return
	}

	username := getEnv("ADMIN_SUPER_USERNAME", getEnv("ADMIN_USERNAME", "superadmin"))
	password, err := getSeedPassword()
	if err != nil {
		log.Printf("ADMIN_SUPER_PASSWORD_ROTATE is set but no password provided; skipping rotation")
		return
	}

	var user AdminUser
	dbErr := db.Where("username = ?", username).First(&user).Error
	if errors.Is(dbErr, gorm.ErrRecordNotFound) {
		log.Printf("No super admin with username '%s' found; creating a new one.", username)
		hash, hErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if hErr != nil {
			log.Printf("failed to hash rotated super admin password: %v", hErr)
			return
		}
		newUser := AdminUser{
			Username:     username,
			PasswordHash: string(hash),
			Role:         AdminRoleSuper,
			IsActive:     true,
		}
		if cErr := db.Create(&newUser).Error; cErr != nil {
			log.Printf("failed to create super admin during rotation: %v", cErr)
			return
		}
		db.Where("username = ?", username).Delete(&AdminLoginAttempt{})
		log.Printf("Super admin created and password set via ADMIN_SUPER_PASSWORD_ROTATE for '%s'.", username)
		return
	} else if dbErr != nil {
		log.Printf("failed to load super admin for rotation: %v", dbErr)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("failed to hash rotated super admin password: %v", err)
		return
	}

	updates := map[string]any{
		"password_hash": string(hash),
		"is_active":     true,
	}
	if err := db.Model(&user).Updates(updates).Error; err != nil {
		log.Printf("failed to rotate super admin password: %v", err)
		return
	}
	db.Where("username = ?", username).Delete(&AdminLoginAttempt{})
	log.Printf("Super admin password rotated for '%s' (ADMIN_SUPER_PASSWORD_ROTATE).", username)
}

func getSeedPassword() (string, error) {
	password := strings.TrimSpace(os.Getenv("ADMIN_SUPER_PASSWORD"))
	if password == "" {
		return "", errors.New("ADMIN_SUPER_PASSWORD must be set")
	}
	return password, nil
}

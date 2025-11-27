package database

import (
	"log"
	"os"

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
	if count > 0 {
		return
	}

	username := getEnv("ADMIN_SUPER_USERNAME", getEnv("ADMIN_USERNAME", "superadmin"))

	password := os.Getenv("ADMIN_SUPER_PASSWORD")
	if password == "" {
		password = os.Getenv("ADMIN_PASSWORD")
	}
	if password == "" {
		password = "ChangeMeNow123!"
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

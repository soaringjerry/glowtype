package audit

import (
	"strings"
)

// Risk level constants
const (
	RiskLow      = "low"
	RiskMedium   = "medium"
	RiskHigh     = "high"
	RiskCritical = "critical"
)

// RiskConfig maps route patterns to risk levels
// Format: "METHOD /path/pattern" -> risk level
// Use :param for path parameters, * for wildcards
var RiskConfig = map[string]string{
	// ========== CRITICAL - Security and system-level operations ==========

	// Password management
	"PUT /api/v1/admin/users/:id/password": RiskCritical,
	"PUT /api/v1/admin/me/password":        RiskCritical,

	// 2FA management
	"PUT /api/v1/admin/users/:id/2fa": RiskCritical,
	"DELETE /api/v1/admin/2fa":        RiskCritical,

	// AI settings (API keys, providers)
	"PUT /api/v1/admin/ai/settings": RiskCritical,

	// Data reset operations
	"POST /api/v1/admin/dimensions/reset":  RiskCritical,
	"POST /api/v1/admin/questions/reset":   RiskCritical,
	"POST /api/v1/admin/glowtypes/reset":   RiskCritical,
	"POST /api/v1/admin/rules/reset":       RiskCritical,
	"POST /api/v1/admin/prompts/reset-all": RiskCritical,
	"POST /api/v1/admin/glowpedia/reset":   RiskCritical,
	"POST /api/v1/admin/crisis/reset":      RiskCritical,

	// ========== HIGH - Core configuration changes ==========

	// Admin user management
	"POST /api/v1/admin/users":     RiskHigh,
	"PUT /api/v1/admin/users/:id":  RiskHigh,
	"POST /api/v1/admin/2fa/setup": RiskHigh,

	// Crisis settings
	"PUT /api/v1/admin/crisis/settings": RiskHigh,

	// Scoring rules (affect test results)
	"POST /api/v1/admin/rules":     RiskHigh,
	"PUT /api/v1/admin/rules/:id":  RiskHigh,
	"DELETE /api/v1/admin/rules/:id": RiskHigh,

	// AI prompts (affect AI behavior)
	"PUT /api/v1/admin/prompts/:id":       RiskHigh,
	"POST /api/v1/admin/prompts/:key/reset": RiskHigh,

	// Bulk imports
	"POST /api/v1/admin/dimensions/import": RiskHigh,
	"POST /api/v1/admin/questions/import":  RiskHigh,
	"POST /api/v1/admin/rules/import":      RiskHigh,

	// ========== MEDIUM - Content management ==========

	// Dimensions
	"POST /api/v1/admin/dimensions":    RiskMedium,
	"PUT /api/v1/admin/dimensions/:id": RiskMedium,
	"DELETE /api/v1/admin/dimensions/:id": RiskMedium,

	// Questions
	"POST /api/v1/admin/questions":    RiskMedium,
	"PUT /api/v1/admin/questions/:id": RiskMedium,
	"DELETE /api/v1/admin/questions/:id": RiskMedium,

	// Glowtypes
	"POST /api/v1/admin/glowtypes":       RiskMedium,
	"PUT /api/v1/admin/glowtypes/:id":    RiskMedium,
	"DELETE /api/v1/admin/glowtypes/:id": RiskMedium,
	"POST /api/v1/admin/glowtypes/i18n":  RiskMedium,
	"PUT /api/v1/admin/glowtypes/i18n/:id": RiskMedium,

	// Crisis keywords/patterns/resources
	"POST /api/v1/admin/crisis/keywords":      RiskMedium,
	"PUT /api/v1/admin/crisis/keywords/:id":   RiskMedium,
	"DELETE /api/v1/admin/crisis/keywords/:id": RiskMedium,
	"POST /api/v1/admin/crisis/keywords/bulk":  RiskMedium,

	"POST /api/v1/admin/crisis/patterns":      RiskMedium,
	"PUT /api/v1/admin/crisis/patterns/:id":   RiskMedium,
	"DELETE /api/v1/admin/crisis/patterns/:id": RiskMedium,

	"POST /api/v1/admin/crisis/resources":      RiskMedium,
	"PUT /api/v1/admin/crisis/resources/:id":   RiskMedium,
	"DELETE /api/v1/admin/crisis/resources/:id": RiskMedium,

	"POST /api/v1/admin/crisis/phrases":      RiskMedium,
	"PUT /api/v1/admin/crisis/phrases/:id":   RiskMedium,
	"DELETE /api/v1/admin/crisis/phrases/:id": RiskMedium,

	"POST /api/v1/admin/crisis/guidance":      RiskMedium,
	"PUT /api/v1/admin/crisis/guidance/:id":   RiskMedium,
	"DELETE /api/v1/admin/crisis/guidance/:id": RiskMedium,

	"POST /api/v1/admin/crisis/scripts":      RiskMedium,
	"PUT /api/v1/admin/crisis/scripts/:id":   RiskMedium,
	"DELETE /api/v1/admin/crisis/scripts/:id": RiskMedium,

	// ========== LOW - Content viewing and minor operations ==========

	// Chapters and glowsticks (Glowpedia)
	"POST /api/v1/admin/chapters":       RiskLow,
	"PUT /api/v1/admin/chapters/:id":    RiskLow,
	"DELETE /api/v1/admin/chapters/:id": RiskLow,

	"POST /api/v1/admin/glowsticks":       RiskLow,
	"PUT /api/v1/admin/glowsticks/:id":    RiskLow,
	"DELETE /api/v1/admin/glowsticks/:id": RiskLow,

	// 2FA device management
	"DELETE /api/v1/admin/2fa/devices":     RiskLow,
	"DELETE /api/v1/admin/2fa/devices/:id": RiskLow,
}

// DetermineRiskLevel determines the risk level for a given method and path
// path should be the route template from c.FullPath(), not the actual URL
func DetermineRiskLevel(method, fullPath string) string {
	// Exact match first
	key := method + " " + fullPath
	if level, ok := RiskConfig[key]; ok {
		return level
	}

	// Try pattern matching for reset operations
	if strings.HasSuffix(fullPath, "/reset") || strings.HasSuffix(fullPath, "/reset-all") {
		if method == "POST" {
			return RiskCritical
		}
	}

	// Try pattern matching for imports
	if strings.HasSuffix(fullPath, "/import") {
		if method == "POST" {
			return RiskHigh
		}
	}

	// Default based on method
	switch method {
	case "GET", "HEAD", "OPTIONS":
		return RiskLow
	case "DELETE":
		return RiskMedium
	case "POST", "PUT", "PATCH":
		return RiskMedium
	default:
		return RiskLow
	}
}

// IsWriteMethod returns true if the method is a write operation
func IsWriteMethod(method string) bool {
	switch method {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}

package server

import (
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/backup"
	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/handlers"
	"github.com/soaringjerry/glowtype/internal/middleware"
	"github.com/soaringjerry/glowtype/internal/services"
	"github.com/soaringjerry/glowtype/internal/storage"
)

func New(cfg config.Config) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize database
	database.InitDB(cfg)

	r := gin.New()
	proxyCfg := buildTrustedProxies(cfg.TrustedProxies)
	if err := r.SetTrustedProxies(proxyCfg.proxies); err != nil {
		log.Fatalf("failed to set trusted proxies: %v", err)
	}
	if proxyCfg.enableCloudflareHeader {
		// Prefer Cloudflare-provided client IP when the request comes from a trusted CF edge.
		r.RemoteIPHeaders = mergeHeaders([]string{gin.PlatformCloudflare}, r.RemoteIPHeaders)
	}
	r.Use(middleware.PrivacyLogger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.AllowedOrigin))

	glowtypesCfg, err := storage.LoadGlowtypes()
	if err != nil {
		log.Fatalf("failed to load glowtypes config: %v", err)
	}

	// Create services with database connection
	db := database.GetDB()
	scoringService := services.NewScoringService(db)
	quizService := services.NewQuizService(db, scoringService)
	glowtypeService := services.NewGlowtypeService(db, glowtypesCfg)
	chatService := services.NewChatService(cfg, db)
	helpService := services.NewHelpService()

	quizHandler := handlers.NewQuizHandler(quizService)
	glowtypeHandler := handlers.NewGlowtypeHandler(glowtypeService)
	chatHandler := handlers.NewChatHandler(chatService, db)
	helpHandler := handlers.NewHelpHandler(helpService)

	api := r.Group("/api/v1")
	{
		api.GET("/health", handlers.HealthHandler)
		api.GET("/quiz", quizHandler.GetQuiz)
		api.POST("/quiz/score", quizHandler.ScoreQuiz)
		api.GET("/glowtypes/:id", glowtypeHandler.GetGlowtype)
		api.POST("/chat/session", chatHandler.CreateSession)
		api.POST("/chat/message", chatHandler.SendMessage)
		api.POST("/chat/insight", chatHandler.GenerateInsight)
		api.POST("/chat/analytics", chatHandler.TrackChatAnalytics)
		api.GET("/help", helpHandler.GetHelp)
		api.GET("/glowpedia", handlers.GetGlowpediaContent)

		// Public stats endpoint (anonymous event tracking)
		api.POST("/stats/event", handlers.RecordEventHandler)

		// Quiz result submission (anonymous, for detailed tracking)
		api.POST("/quiz/result", handlers.SubmitQuizResultHandler)

		// Public prompts endpoint (for AI features)
		api.GET("/prompts", handlers.GetPublicPrompts)
	}

	// Admin routes
	admin := r.Group("/api/v1/admin")
	admin.POST("/login", handlers.AdminLoginHandler)

	// 2FA authentication (no auth required, uses temporary 2FA token)
	admin.POST("/2fa/authenticate", handlers.Authenticate2FAHandler)

	admin.Use(handlers.AdminAuthMiddleware(), handlers.Require2FACompletionMiddleware(), handlers.AdminAuditMiddleware())
	{
		admin.GET("/me", handlers.GetAdminProfile)
		admin.PUT("/me/password", handlers.ChangePasswordHandler)            // Change password
		admin.GET("/permissions/templates", handlers.GetPermissionTemplates) // Available to all admins for UI

		// 2FA management (requires auth)
		admin.GET("/2fa/status", handlers.Get2FAStatusHandler)
		admin.POST("/2fa/setup", handlers.Setup2FAHandler)
		admin.POST("/2fa/verify", handlers.Verify2FAHandler)
		admin.DELETE("/2fa", handlers.Disable2FAHandler)
		admin.POST("/2fa/recovery/regenerate", handlers.RegenerateRecoveryCodesHandler)
		admin.GET("/2fa/devices", handlers.ListTrustedDevicesHandler)
		admin.DELETE("/2fa/devices/:id", handlers.RevokeTrustedDeviceHandler)
		admin.DELETE("/2fa/devices", handlers.RevokeAllTrustedDevicesHandler)

		// Admin user management
		adminUsers := admin.Group("/")
		adminUsers.Use(handlers.RequirePermission(handlers.PermManageAdmins))
		{
			adminUsers.GET("/users", handlers.ListAdminUsers)
			adminUsers.POST("/users", handlers.CreateAdminUser)
			adminUsers.PUT("/users/:id", handlers.UpdateAdminUser)
			adminUsers.PUT("/users/:id/2fa", handlers.ManageUser2FAHandler) // Superadmin 2FA management
		}

		// Audit
		adminAudit := admin.Group("/")
		adminAudit.Use(handlers.RequirePermission(handlers.PermAuditView))
		adminAudit.GET("/audit", handlers.ListAuditLogs)

		// Trait Dimensions CRUD
		dimensions := admin.Group("/")
		dimensions.Use(handlers.RequirePermission(handlers.PermDimensions))
		{
			dimensions.GET("/dimensions", handlers.ListDimensions)
			dimensions.POST("/dimensions", handlers.CreateDimension)
			dimensions.PUT("/dimensions/:id", handlers.UpdateDimension)
			dimensions.DELETE("/dimensions/:id", handlers.DeleteDimension)
			dimensions.POST("/dimensions/import", handlers.ImportDimensions)
			dimensions.GET("/dimensions/export", handlers.ExportDimensions)
		}

		// Quiz Questions CRUD
		questions := admin.Group("/")
		questions.Use(handlers.RequirePermission(handlers.PermQuestions))
		{
			questions.GET("/questions", handlers.ListQuestions)
			questions.POST("/questions", handlers.CreateQuestion)
			questions.PUT("/questions/:id", handlers.UpdateQuestion)
			questions.DELETE("/questions/:id", handlers.DeleteQuestion)
			questions.POST("/questions/import", handlers.ImportQuestions)
		}

		// Glowtypes CRUD
		glowtypes := admin.Group("/")
		glowtypes.Use(handlers.RequirePermission(handlers.PermGlowtypes))
		{
			glowtypes.GET("/glowtypes", handlers.ListGlowtypes)
			glowtypes.GET("/glowtypes/:id", handlers.GetGlowtypeWithI18N)
			glowtypes.POST("/glowtypes", handlers.CreateGlowtype)
			glowtypes.PUT("/glowtypes/:id", handlers.UpdateGlowtype)
			glowtypes.DELETE("/glowtypes/:id", handlers.DeleteGlowtype)

			// Glowtype I18N
			glowtypes.POST("/glowtypes/i18n", handlers.CreateGlowtypeI18N)
			glowtypes.PUT("/glowtypes/i18n/:id", handlers.UpdateGlowtypeI18N)
		}

		// Scoring Rules CRUD
		rules := admin.Group("/")
		rules.Use(handlers.RequirePermission(handlers.PermRules))
		{
			rules.GET("/rules", handlers.ListRules)
			rules.POST("/rules", handlers.CreateRule)
			rules.PUT("/rules/:id", handlers.UpdateRule)
			rules.DELETE("/rules/:id", handlers.DeleteRule)
			rules.POST("/rules/import", handlers.ImportRules)
			rules.GET("/rules/export", handlers.ExportRules)

			// Rule Debugging
			rules.POST("/rules/debug", handlers.DebugRules)
			rules.GET("/rules/validate", handlers.ValidateRules)
		}

		// AI Prompts (fixed slots - can update/reset but not create/delete)
		prompts := admin.Group("/")
		prompts.Use(handlers.RequirePermission(handlers.PermPrompts))
		{
			prompts.GET("/prompts", handlers.ListPrompts)
			prompts.PUT("/prompts/:id", handlers.UpdatePrompt)
			prompts.POST("/prompts/:key/reset", handlers.ResetPrompt)
		}

		// AI Settings (API key, model config - superadmin only)
		aiSettings := admin.Group("/")
		aiSettings.Use(handlers.RequireSuperAdmin())
		{
			aiSettings.GET("/ai/settings", handlers.GetAISettings)
			aiSettings.PUT("/ai/settings", handlers.UpdateAISettings)
		}

		// Statistics
		stats := admin.Group("/")
		stats.Use(handlers.RequirePermission(handlers.PermStatsView))
		{
			stats.GET("/stats/overview", handlers.GetStatsOverview)
			stats.GET("/stats/daily", handlers.GetDailyStats)
			stats.GET("/stats/glowtypes", handlers.GetGlowtypeDistribution)
			stats.GET("/stats/enhanced", handlers.GetEnhancedStatsHandler)
			stats.GET("/stats/analytics", handlers.GetAnalyticsHandler)

			// Analytics AI Chat (uses same permission as stats)
			analyticsChatHandler := handlers.NewAnalyticsChatHandler(chatService)
			stats.POST("/analytics/chat", analyticsChatHandler.Chat)
			stats.POST("/analytics/quick-question", analyticsChatHandler.QuickQuestion)
		}

		// Quiz Results
		results := admin.Group("/")
		results.Use(handlers.RequirePermission(handlers.PermResultsView))
		results.GET("/results", handlers.ListQuizResults)

		// Glowpedia (光签)
		content := admin.Group("/")
		content.Use(handlers.RequirePermission(handlers.PermContent))
		{
			content.GET("/chapters", handlers.ListChapters)
			content.POST("/chapters", handlers.CreateChapter)
			content.PUT("/chapters/:id", handlers.UpdateChapter)
			content.DELETE("/chapters/:id", handlers.DeleteChapter)
			content.GET("/glowsticks", handlers.ListGlowSticks)
			content.POST("/glowsticks", handlers.CreateGlowStick)
			content.PUT("/glowsticks/:id", handlers.UpdateGlowStick)
			content.DELETE("/glowsticks/:id", handlers.DeleteGlowStick)
		}

		// Reset to Defaults
		reset := admin.Group("/")
		reset.Use(handlers.RequirePermission(handlers.PermResetData))
		{
			reset.POST("/dimensions/reset", handlers.ResetDimensionsHandler)
			reset.POST("/questions/reset", handlers.ResetQuestionsHandler)
			reset.POST("/glowtypes/reset", handlers.ResetGlowtypesHandler)
			reset.POST("/rules/reset", handlers.ResetRulesHandler)
			reset.POST("/prompts/reset-all", handlers.ResetPromptsHandler)
			reset.POST("/glowpedia/reset", handlers.ResetGlowpediaHandler)
		}
	}

	// Start background database backups (no HTTP surface exposed)
	backup.Start(backup.Config{
		Enabled:       cfg.BackupEnabled,
		DBPath:        cfg.DBPath,
		BackupDir:     cfg.BackupDir,
		Interval:      time.Duration(cfg.BackupIntervalMins) * time.Minute,
		MaxTotalBytes: cfg.BackupMaxTotalBytes,
		MinFreeBytes:  cfg.BackupMinFreeBytes,
	}, db)

	return r
}

// buildTrustedProxies returns proxy CIDRs for Gin.
// "auto" trusts loopback + private ranges (works for docker/k8s behind one hop reverse proxy).
// "cloudflare" (or "cf") expands to official Cloudflare edge CIDRs, and also enables the CF-Connecting-IP header.
// Any other value: comma-separated CIDR/IP list. Empty/none = trust none.
func buildTrustedProxies(raw string) proxyConfig {
	value := strings.TrimSpace(raw)
	if value == "" || strings.EqualFold(value, "none") {
		return proxyConfig{proxies: []string{}}
	}

	var proxies []string
	enableCloudflareHeader := false

	for _, part := range strings.Split(value, ",") {
		token := strings.ToLower(strings.TrimSpace(part))
		if token == "" {
			continue
		}

		switch token {
		case "auto":
			proxies = append(proxies, defaultAutoTrustedProxies...)
		case "cloudflare", "cf":
			proxies = append(proxies, cloudflareTrustedProxies...)
			enableCloudflareHeader = true
		default:
			proxies = append(proxies, token)
		}
	}

	return proxyConfig{
		proxies:                dedupeStrings(proxies),
		enableCloudflareHeader: enableCloudflareHeader,
	}
}

type proxyConfig struct {
	proxies                []string
	enableCloudflareHeader bool
}

var defaultAutoTrustedProxies = []string{
	"127.0.0.1",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"::1",
}

// Cloudflare edge CIDRs as of 2025-01-02 (https://www.cloudflare.com/ips/).
var cloudflareTrustedProxies = []string{
	"173.245.48.0/20",
	"103.21.244.0/22",
	"103.22.200.0/22",
	"103.31.4.0/22",
	"141.101.64.0/18",
	"108.162.192.0/18",
	"190.93.240.0/20",
	"188.114.96.0/20",
	"197.234.240.0/22",
	"198.41.128.0/17",
	"162.158.0.0/15",
	"104.16.0.0/13",
	"104.24.0.0/14",
	"172.64.0.0/13",
	"131.0.72.0/22",
	"2400:cb00::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2405:b500::/32",
	"2405:8100::/32",
	"2a06:98c0::/29",
	"2c0f:f248::/32",
}

func dedupeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, v := range values {
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		result = append(result, v)
	}
	return result
}

func mergeHeaders(prefix []string, existing []string) []string {
	return dedupeStrings(append(prefix, existing...))
}

package server

import (
	"log"
	"strings"

	"github.com/gin-gonic/gin"
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
	database.InitDB()

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
	chatService := services.NewChatService(cfg)
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
	admin.Use(handlers.AdminAuthMiddleware(), handlers.AdminAuditMiddleware())
	{
		admin.GET("/me", handlers.GetAdminProfile)

		// Admin user management & audit (super admin only)
		super := admin.Group("/")
		super.Use(handlers.RequireSuperAdmin())
		{
			super.GET("/users", handlers.ListAdminUsers)
			super.POST("/users", handlers.CreateAdminUser)
			super.GET("/audit", handlers.ListAuditLogs)
		}

		// Trait Dimensions CRUD
		admin.GET("/dimensions", handlers.ListDimensions)
		admin.POST("/dimensions", handlers.CreateDimension)
		admin.PUT("/dimensions/:id", handlers.UpdateDimension)
		admin.DELETE("/dimensions/:id", handlers.DeleteDimension)
		admin.POST("/dimensions/import", handlers.ImportDimensions)
		admin.GET("/dimensions/export", handlers.ExportDimensions)

		// Quiz Questions CRUD
		admin.GET("/questions", handlers.ListQuestions)
		admin.POST("/questions", handlers.CreateQuestion)
		admin.PUT("/questions/:id", handlers.UpdateQuestion)
		admin.DELETE("/questions/:id", handlers.DeleteQuestion)
		admin.POST("/questions/import", handlers.ImportQuestions)

		// Glowtypes CRUD
		admin.GET("/glowtypes", handlers.ListGlowtypes)
		admin.GET("/glowtypes/:id", handlers.GetGlowtypeWithI18N)
		admin.POST("/glowtypes", handlers.CreateGlowtype)
		admin.PUT("/glowtypes/:id", handlers.UpdateGlowtype)
		admin.DELETE("/glowtypes/:id", handlers.DeleteGlowtype)

		// Glowtype I18N
		admin.POST("/glowtypes/i18n", handlers.CreateGlowtypeI18N)
		admin.PUT("/glowtypes/i18n/:id", handlers.UpdateGlowtypeI18N)

		// Scoring Rules CRUD
		admin.GET("/rules", handlers.ListRules)
		admin.POST("/rules", handlers.CreateRule)
		admin.PUT("/rules/:id", handlers.UpdateRule)
		admin.DELETE("/rules/:id", handlers.DeleteRule)
		admin.POST("/rules/import", handlers.ImportRules)
		admin.GET("/rules/export", handlers.ExportRules)

		// Rule Debugging
		admin.POST("/rules/debug", handlers.DebugRules)
		admin.GET("/rules/validate", handlers.ValidateRules)

		// AI Prompts (fixed slots - can update/reset but not create/delete)
		admin.GET("/prompts", handlers.ListPrompts)
		admin.PUT("/prompts/:id", handlers.UpdatePrompt)
		admin.POST("/prompts/:key/reset", handlers.ResetPrompt)

		// Statistics
		admin.GET("/stats/overview", handlers.GetStatsOverview)
		admin.GET("/stats/daily", handlers.GetDailyStats)
		admin.GET("/stats/glowtypes", handlers.GetGlowtypeDistribution)
		admin.GET("/stats/enhanced", handlers.GetEnhancedStatsHandler)

		// Quiz Results
		admin.GET("/results", handlers.ListQuizResults)

		// Glowpedia (光签)
		admin.GET("/chapters", handlers.ListChapters)
		admin.POST("/chapters", handlers.CreateChapter)
		admin.PUT("/chapters/:id", handlers.UpdateChapter)
		admin.DELETE("/chapters/:id", handlers.DeleteChapter)
		admin.GET("/glowsticks", handlers.ListGlowSticks)
		admin.POST("/glowsticks", handlers.CreateGlowStick)
		admin.PUT("/glowsticks/:id", handlers.UpdateGlowStick)
		admin.DELETE("/glowsticks/:id", handlers.DeleteGlowStick)

		// Reset to Defaults
		admin.POST("/dimensions/reset", handlers.ResetDimensionsHandler)
		admin.POST("/questions/reset", handlers.ResetQuestionsHandler)
		admin.POST("/glowtypes/reset", handlers.ResetGlowtypesHandler)
		admin.POST("/rules/reset", handlers.ResetRulesHandler)
		admin.POST("/prompts/reset-all", handlers.ResetPromptsHandler)
		admin.POST("/glowpedia/reset", handlers.ResetGlowpediaHandler)
	}

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

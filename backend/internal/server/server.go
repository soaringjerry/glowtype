package server

import (
	"log"

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
	r.Use(middleware.PrivacyLogger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.AllowedOrigin))

	quizCfg, err := storage.LoadQuizConfig()
	if err != nil {
		log.Fatalf("failed to load quiz config: %v", err)
	}
	glowtypesCfg, err := storage.LoadGlowtypes()
	if err != nil {
		log.Fatalf("failed to load glowtypes config: %v", err)
	}

	quizService := services.NewQuizService(quizCfg)
	glowtypeService := services.NewGlowtypeService(glowtypesCfg)
	chatService := services.NewChatService()
	helpService := services.NewHelpService()

	quizHandler := handlers.NewQuizHandler(quizService)
	glowtypeHandler := handlers.NewGlowtypeHandler(glowtypeService)
	chatHandler := handlers.NewChatHandler(chatService)
	helpHandler := handlers.NewHelpHandler(helpService)

	api := r.Group("/api/v1")
	{
		api.GET("/health", handlers.HealthHandler)
		api.GET("/quiz", quizHandler.GetQuiz)
		api.POST("/quiz/score", quizHandler.ScoreQuiz)
		api.GET("/glowtypes/:id", glowtypeHandler.GetGlowtype)
		api.POST("/chat/session", chatHandler.CreateSession)
		api.POST("/chat/message", chatHandler.SendMessage)
		api.GET("/help", helpHandler.GetHelp)

		// Public stats endpoint (anonymous event tracking)
		api.POST("/stats/event", handlers.RecordEventHandler)
	}

	// Admin routes
	admin := r.Group("/api/v1/admin")
	admin.POST("/login", handlers.AdminLoginHandler)
	admin.Use(handlers.AdminAuthMiddleware())
	{
		// Trait Dimensions CRUD
		admin.GET("/dimensions", handlers.ListDimensions)
		admin.POST("/dimensions", handlers.CreateDimension)
		admin.PUT("/dimensions/:id", handlers.UpdateDimension)
		admin.DELETE("/dimensions/:id", handlers.DeleteDimension)

		// Quiz Questions CRUD
		admin.GET("/questions", handlers.ListQuestions)
		admin.POST("/questions", handlers.CreateQuestion)
		admin.PUT("/questions/:id", handlers.UpdateQuestion)
		admin.DELETE("/questions/:id", handlers.DeleteQuestion)

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

		// Rule Debugging
		admin.POST("/rules/debug", handlers.DebugRules)
		admin.GET("/rules/validate", handlers.ValidateRules)

		// AI Prompts
		admin.GET("/prompts", handlers.ListPrompts)
		admin.POST("/prompts", handlers.CreatePrompt)
		admin.PUT("/prompts/:id", handlers.UpdatePrompt)

		// Statistics
		admin.GET("/stats/overview", handlers.GetStatsOverview)
		admin.GET("/stats/daily", handlers.GetDailyStats)
		admin.GET("/stats/glowtypes", handlers.GetGlowtypeDistribution)

		// Quiz Results
		admin.GET("/results", handlers.ListQuizResults)
	}

	return r
}


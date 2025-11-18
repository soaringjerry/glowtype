package server

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/handlers"
	"github.com/soaringjerry/glowtype/internal/middleware"
	"github.com/soaringjerry/glowtype/internal/services"
	"github.com/soaringjerry/glowtype/internal/storage"
)

func New(cfg config.Config) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

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
	}

	return r
}


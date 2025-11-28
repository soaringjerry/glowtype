package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/models"
	"gorm.io/gorm"
)

type QuizService struct {
	db             *gorm.DB
	scoringService *ScoringService
}

func NewQuizService(db *gorm.DB, scoringService *ScoringService) *QuizService {
	return &QuizService{
		db:             db,
		scoringService: scoringService,
	}
}

func (s *QuizService) GetQuiz(lang string) models.QuizResponse {
	lang = normalizeLangInternal(lang)

	// Query active questions from database
	var questions []database.QuizQuestionDB
	s.db.Where("is_active = ? AND tenant_id IS NULL", true).Order("\"order\" asc").Find(&questions)

	quizQuestions := make([]models.QuizQuestionDTO, 0, len(questions))

	for _, q := range questions {
		// Parse options JSON
		var options []database.OptionConfig
		if err := json.Unmarshal(q.Options, &options); err != nil {
			continue
		}

		// Get question text based on language
		var questionText string
		if lang == "zh-CN" && q.QuestionZH != "" {
			questionText = q.QuestionZH
		} else {
			questionText = q.QuestionEN
		}

		// Build options
		opts := make([]models.QuizOptionDTO, 0, len(options))
		for idx, opt := range options {
			optionID := fmt.Sprintf("o%d", idx+1)

			// Get option text based on language
			var optionText string
			if lang == "zh-CN" {
				if text, ok := opt.Text["zh"]; ok && text != "" {
					optionText = text
				} else if text, ok := opt.Text["zh-CN"]; ok && text != "" {
					optionText = text
				} else {
					optionText = opt.Text["en"]
				}
			} else {
				optionText = opt.Text["en"]
			}

			opts = append(opts, models.QuizOptionDTO{
				ID:   optionID,
				Text: optionText,
			})
		}

		quizQuestions = append(quizQuestions, models.QuizQuestionDTO{
			ID:       q.QuestionID,
			Order:    q.Order,
			Question: questionText,
			Options:  opts,
		})
	}

	return models.QuizResponse{
		QuizID:    uuid.New().String(),
		Language:  lang,
		Questions: quizQuestions,
	}
}

// ScoreQuiz processes quiz answers and returns the matching Glowtype
// Deprecated: use ScoreQuizWithMeta for better analytics
func (s *QuizService) ScoreQuiz(req models.QuizScoreRequest) models.QuizScoreResponse {
	return s.ScoreQuizWithMeta(req, models.RequestMeta{})
}

// ScoreQuizWithMeta processes quiz answers with request metadata for analytics
func (s *QuizService) ScoreQuizWithMeta(req models.QuizScoreRequest, meta models.RequestMeta) models.QuizScoreResponse {
	// Convert frontend answers to database format
	answers := make([]database.AnswerRecord, 0, len(req.Answers))
	for _, ans := range req.Answers {
		// Parse optionId like "o1" -> index 0, "o2" -> index 1, etc.
		optionIndex := 0
		if len(ans.OptionID) > 1 && ans.OptionID[0] == 'o' {
			fmt.Sscanf(ans.OptionID[1:], "%d", &optionIndex)
			optionIndex-- // Convert 1-based to 0-based
		}

		answers = append(answers, database.AnswerRecord{
			QuestionID:  ans.QuestionID,
			OptionIndex: optionIndex,
		})
	}

	// Use scoring service to calculate result
	result, err := s.scoringService.ScoreQuiz(answers, nil, false)
	if err != nil {
		return models.QuizScoreResponse{
			GlowtypeID:   "quiet-comet", // Default fallback
			ScoreDetails: map[string]interface{}{"error": err.Error()},
		}
	}

	// Save quiz result to database (async, don't block response)
	go s.saveQuizResult(answers, result, req.Language, meta)

	return models.QuizScoreResponse{
		GlowtypeID:   result.ResultTypeCode,
		ScoreDetails: map[string]interface{}{"scores": result.DimensionScores},
	}
}

// saveQuizResult saves the quiz result to the database for analytics
// Uses answers hash + time window to prevent duplicate submissions
// - Same answers within 30 seconds = duplicate (network retry), skip
// - Same answers after 30 seconds = different person, save
// - Different answers = always save
func (s *QuizService) saveQuizResult(answers []database.AnswerRecord, result *ScoringResult, language string, meta models.RequestMeta) {
	answersJSON, _ := json.Marshal(answers)
	scoresJSON, _ := json.Marshal(result.DimensionScores)

	// Generate hash of answers for deduplication
	answersHash := hashAnswers(answersJSON)

	// Check for duplicate: same answers hash within last 30 seconds
	var recentCount int64
	cutoffTime := time.Now().Add(-30 * time.Second)
	s.db.Model(&database.QuizResultDB{}).
		Where("answers_hash = ? AND created_at > ?", answersHash, cutoffTime).
		Count(&recentCount)

	if recentCount > 0 {
		log.Printf("[QuizService] Skipping duplicate submission (same answers within 30s), hash=%s", answersHash[:16])
		return
	}

	quizResult := database.QuizResultDB{
		SessionID:       uuid.New().String(), // Always generate new session ID
		AnswersHash:     answersHash,
		Answers:         answersJSON,
		DimensionScores: scoresJSON,
		ResultTypeCode:  result.ResultTypeCode,
		Language:        language,
		Source:          "web",
		// Anonymized analytics fields
		Region:      meta.Region,
		DeviceType:  meta.DeviceType,
		BrowserLang: meta.BrowserLang,
		HourOfDay:   meta.HourOfDay,
		Channel:     meta.Channel,
		EntryPoint:  meta.EntryPoint,
		UserAgent:   meta.UserAgent,
	}

	if err := s.db.Create(&quizResult).Error; err != nil {
		log.Printf("[QuizService] Failed to save quiz result: %v", err)
	}
}

// hashAnswers generates a SHA256 hash of the answers JSON for deduplication
func hashAnswers(answersJSON []byte) string {
	hash := sha256.Sum256(answersJSON)
	return hex.EncodeToString(hash[:])
}

// normalizeLangInternal is defined in glowtype_service.go

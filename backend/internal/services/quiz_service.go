package services

import (
	"fmt"

	"github.com/soaringjerry/glowtype/internal/models"
)

type QuizService struct {
	cfg *models.QuizConfig
}

func NewQuizService(cfg *models.QuizConfig) *QuizService {
	return &QuizService{cfg: cfg}
}

func (s *QuizService) GetQuiz(lang string) models.QuizResponse {
	lang = normalizeLangInternal(lang)
	questions := make([]models.QuizQuestionDTO, 0, len(s.cfg.Questions))

	for _, q := range s.cfg.Questions {
		loc, ok := q.Translations[lang]
		if !ok {
			loc = q.Translations["en"]
		}

		opts := make([]models.QuizOptionDTO, 0, len(loc.Options))
		for idx, text := range loc.Options {
			optionID := "o" + strconvI(idx+1)
			opts = append(opts, models.QuizOptionDTO{
				ID:   optionID,
				Text: text,
			})
		}

		questions = append(questions, models.QuizQuestionDTO{
			ID:       q.ID,
			Order:    q.Order,
			Question: loc.Question,
			Options:  opts,
		})
	}

	return models.QuizResponse{
		QuizID:    s.cfg.ID,
		Language:  lang,
		Questions: questions,
	}
}

// ScoreQuiz currently returns a simple placeholder glowtype.
// The logic can be refined later without changing the API.
func (s *QuizService) ScoreQuiz(req models.QuizScoreRequest) models.QuizScoreResponse {
	_ = req // placeholder: use answers in future

	return models.QuizScoreResponse{
		GlowtypeID:   "quiet-comet",
		ScoreDetails: map[string]interface{}{},
	}
}

func strconvI(i int) string {
	return fmt.Sprintf("%d", i)
}

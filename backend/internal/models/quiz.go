package models

// QuizConfig is the language-agnostic configuration loaded from JSON.
type QuizConfig struct {
	ID        string           `json:"id"`
	Questions []QuizQuestion   `json:"questions"`
}

type QuizQuestion struct {
	ID           string                           `json:"id"`
	Order        int                              `json:"order"`
	Translations map[string]QuizQuestionLocalized `json:"translations"`
}

type QuizQuestionLocalized struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

// QuizQuestionDTO is the per-language representation returned to clients.
type QuizQuestionDTO struct {
	ID       string              `json:"id"`
	Order    int                 `json:"order"`
	Question string              `json:"question"`
	Options  []QuizOptionDTO     `json:"options"`
}

type QuizOptionDTO struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type QuizResponse struct {
	QuizID    string            `json:"quizId"`
	Language  string            `json:"language"`
	Questions []QuizQuestionDTO `json:"questions"`
}

type QuizAnswer struct {
	QuestionID string `json:"questionId"`
	OptionID   string `json:"optionId"`
}

type QuizScoreRequest struct {
	QuizID   string       `json:"quizId"`
	Language string       `json:"language"`
	Answers  []QuizAnswer `json:"answers"`
}

type QuizScoreResponse struct {
	GlowtypeID   string                 `json:"glowtypeId"`
	ScoreDetails map[string]interface{} `json:"scoreDetails,omitempty"`
}


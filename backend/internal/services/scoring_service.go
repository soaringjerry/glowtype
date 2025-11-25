package services

import (
	"encoding/json"
	"errors"
	"sort"

	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
)

// ScoringService handles quiz scoring and Glowtype matching
type ScoringService struct {
	db *gorm.DB
}

// NewScoringService creates a new scoring service
func NewScoringService(db *gorm.DB) *ScoringService {
	return &ScoringService{db: db}
}

// ScoringResult contains the result of scoring a quiz
type ScoringResult struct {
	DimensionScores map[string]float64 `json:"dimensionScores"`
	ResultTypeCode  string             `json:"resultTypeCode"`
	MatchedRuleID   *uint              `json:"matchedRuleId,omitempty"`
	MatchedRuleName string             `json:"matchedRuleName,omitempty"`
	IsFallback      bool               `json:"isFallback"`
	DebugInfo       *MatchDebugInfo    `json:"debugInfo,omitempty"`
}

// MatchDebugInfo provides debugging information for rule matching
type MatchDebugInfo struct {
	EvaluatedRules []RuleEvaluation `json:"evaluatedRules"`
	UnmatchedDims  []string         `json:"unmatchedDims,omitempty"`
}

// RuleEvaluation shows how a rule was evaluated
type RuleEvaluation struct {
	RuleID         uint                       `json:"ruleId"`
	RuleName       string                     `json:"ruleName"`
	Priority       int                        `json:"priority"`
	ResultTypeCode string                     `json:"resultTypeCode"`
	Matched        bool                       `json:"matched"`
	DimResults     map[string]DimEvalResult   `json:"dimResults"`
}

// DimEvalResult shows evaluation result for a single dimension
type DimEvalResult struct {
	Score     float64  `json:"score"`
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
	InRange   bool     `json:"inRange"`
}

// CalculateScores calculates dimension scores from answers
func (s *ScoringService) CalculateScores(answers []database.AnswerRecord, tenantID *uint) (map[string]float64, error) {
	scores := make(map[string]float64)

	// Build question lookup
	var questions []database.QuizQuestionDB
	query := s.db.Where("is_active = ?", true)
	if tenantID != nil {
		query = query.Where("tenant_id = ? OR tenant_id IS NULL", *tenantID)
	} else {
		query = query.Where("tenant_id IS NULL")
	}
	if err := query.Find(&questions).Error; err != nil {
		return nil, err
	}

	questionMap := make(map[string]database.QuizQuestionDB)
	for _, q := range questions {
		questionMap[q.QuestionID] = q
	}

	// Process each answer
	for _, answer := range answers {
		question, ok := questionMap[answer.QuestionID]
		if !ok {
			continue // Skip unknown questions
		}

		var options []database.OptionConfig
		if err := json.Unmarshal(question.Options, &options); err != nil {
			continue
		}

		// Find the selected option
		if answer.OptionIndex >= 0 && answer.OptionIndex < len(options) {
			opt := options[answer.OptionIndex]
			for dimKey, delta := range opt.Scores {
				scores[dimKey] += delta
			}
		}
	}

	return scores, nil
}

// MatchGlowtype finds the matching Glowtype based on dimension scores
// Decision Protocol:
// 1. Rules are evaluated in Priority order (higher priority first)
// 2. First matching rule wins
// 3. If no rule matches, use fallback rule or return "Unmapped"
func (s *ScoringService) MatchGlowtype(scores map[string]float64, tenantID *uint, debug bool) (*ScoringResult, error) {
	result := &ScoringResult{
		DimensionScores: scores,
		ResultTypeCode:  "Unmapped",
	}

	if debug {
		result.DebugInfo = &MatchDebugInfo{
			EvaluatedRules: []RuleEvaluation{},
		}
	}

	// Load active rules, sorted by priority DESC
	var rules []database.ScoringRuleDB
	query := s.db.Where("is_active = ?", true)
	if tenantID != nil {
		query = query.Where("tenant_id = ? OR tenant_id IS NULL", *tenantID)
	} else {
		query = query.Where("tenant_id IS NULL")
	}
	if err := query.Order("priority DESC").Find(&rules).Error; err != nil {
		return nil, err
	}

	// Separate fallback rules
	var normalRules, fallbackRules []database.ScoringRuleDB
	for _, r := range rules {
		if r.IsFallback {
			fallbackRules = append(fallbackRules, r)
		} else {
			normalRules = append(normalRules, r)
		}
	}

	// Sort by priority DESC (higher first)
	sort.Slice(normalRules, func(i, j int) bool {
		return normalRules[i].Priority > normalRules[j].Priority
	})
	sort.Slice(fallbackRules, func(i, j int) bool {
		return fallbackRules[i].Priority > fallbackRules[j].Priority
	})

	// Evaluate normal rules first
	for _, rule := range normalRules {
		matched, eval := s.evaluateRule(rule, scores)

		if debug {
			result.DebugInfo.EvaluatedRules = append(result.DebugInfo.EvaluatedRules, eval)
		}

		if matched {
			result.ResultTypeCode = rule.ResultTypeCode
			result.MatchedRuleID = &rule.ID
			result.MatchedRuleName = rule.Name
			result.IsFallback = false
			return result, nil
		}
	}

	// No normal rule matched, try fallback
	if len(fallbackRules) > 0 {
		fallback := fallbackRules[0]
		result.ResultTypeCode = fallback.ResultTypeCode
		result.MatchedRuleID = &fallback.ID
		result.MatchedRuleName = fallback.Name
		result.IsFallback = true
		return result, nil
	}

	// No rule matched at all
	if debug {
		result.DebugInfo.UnmatchedDims = s.findUnmatchedDimensions(scores, rules)
	}

	return result, nil
}

// evaluateRule checks if a rule matches the given scores
func (s *ScoringService) evaluateRule(rule database.ScoringRuleDB, scores map[string]float64) (bool, RuleEvaluation) {
	eval := RuleEvaluation{
		RuleID:         rule.ID,
		RuleName:       rule.Name,
		Priority:       rule.Priority,
		ResultTypeCode: rule.ResultTypeCode,
		Matched:        true,
		DimResults:     make(map[string]DimEvalResult),
	}

	var conditions database.RuleConditions
	if err := json.Unmarshal(rule.Conditions, &conditions); err != nil {
		eval.Matched = false
		return false, eval
	}

	// Check each dimension condition
	for dimKey, cond := range conditions.Dimensions {
		score := scores[dimKey] // defaults to 0 if not present

		dimResult := DimEvalResult{
			Score:   score,
			Min:     cond.Min,
			Max:     cond.Max,
			InRange: true,
		}

		// Check min bound: score >= min
		if cond.Min != nil && score < *cond.Min {
			dimResult.InRange = false
			eval.Matched = false
		}

		// Check max bound: score <= max
		if cond.Max != nil && score > *cond.Max {
			dimResult.InRange = false
			eval.Matched = false
		}

		eval.DimResults[dimKey] = dimResult
	}

	return eval.Matched, eval
}

// findUnmatchedDimensions identifies which dimensions caused no match
func (s *ScoringService) findUnmatchedDimensions(scores map[string]float64, rules []database.ScoringRuleDB) []string {
	unmatchedCount := make(map[string]int)

	for _, rule := range rules {
		if rule.IsFallback {
			continue
		}

		var conditions database.RuleConditions
		if err := json.Unmarshal(rule.Conditions, &conditions); err != nil {
			continue
		}

		for dimKey, cond := range conditions.Dimensions {
			score := scores[dimKey]
			inRange := true
			if cond.Min != nil && score < *cond.Min {
				inRange = false
			}
			if cond.Max != nil && score > *cond.Max {
				inRange = false
			}
			if !inRange {
				unmatchedCount[dimKey]++
			}
		}
	}

	// Return dimensions that failed in all rules
	var result []string
	for dim, count := range unmatchedCount {
		if count == len(rules)-countFallbacks(rules) {
			result = append(result, dim)
		}
	}
	return result
}

func countFallbacks(rules []database.ScoringRuleDB) int {
	count := 0
	for _, r := range rules {
		if r.IsFallback {
			count++
		}
	}
	return count
}

// ScoreQuiz is the main entry point: takes answers, returns Glowtype result
func (s *ScoringService) ScoreQuiz(answers []database.AnswerRecord, tenantID *uint, debug bool) (*ScoringResult, error) {
	if len(answers) == 0 {
		return nil, errors.New("no answers provided")
	}

	// Step 1: Calculate dimension scores
	scores, err := s.CalculateScores(answers, tenantID)
	if err != nil {
		return nil, err
	}

	// Step 2: Match Glowtype
	result, err := s.MatchGlowtype(scores, tenantID, debug)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// ValidateRules checks for common rule configuration issues
func (s *ScoringService) ValidateRules(tenantID *uint) ([]string, error) {
	var warnings []string

	var rules []database.ScoringRuleDB
	query := s.db.Where("is_active = ?", true)
	if tenantID != nil {
		query = query.Where("tenant_id = ? OR tenant_id IS NULL", *tenantID)
	} else {
		query = query.Where("tenant_id IS NULL")
	}
	if err := query.Find(&rules).Error; err != nil {
		return nil, err
	}

	// Check 1: Is there at least one fallback?
	hasFallback := false
	for _, r := range rules {
		if r.IsFallback {
			hasFallback = true
			break
		}
	}
	if !hasFallback {
		warnings = append(warnings, "No fallback rule defined. Some users may get 'Unmapped' result.")
	}

	// Check 2: Duplicate priorities (potential ambiguity)
	priorityMap := make(map[int][]string)
	for _, r := range rules {
		if !r.IsFallback {
			priorityMap[r.Priority] = append(priorityMap[r.Priority], r.Name)
		}
	}
	for priority, names := range priorityMap {
		if len(names) > 1 {
			warnings = append(warnings,
				"Multiple rules with same priority "+string(rune(priority))+": "+
				names[0]+" and "+names[1]+". First in DB order wins.")
		}
	}

	return warnings, nil
}

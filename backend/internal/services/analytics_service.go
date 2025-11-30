package services

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
)

// AnalyticsService handles advanced statistical analysis for quiz data
type AnalyticsService struct {
	db           *gorm.DB
	cacheService *AnalyticsCacheService
}

const (
	minReliabilitySample = 30
	minCorrelationSample = 15
	minValiditySample    = 100 // Minimum sample for validity analysis
)

// NewAnalyticsService creates a new analytics service
func NewAnalyticsService(db *gorm.DB) *AnalyticsService {
	return &AnalyticsService{
		db:           db,
		cacheService: NewAnalyticsCacheService(db),
	}
}

// AnalyticsRequest contains parameters for analytics queries
type AnalyticsRequest struct {
	StartDate string // YYYY-MM-DD
	EndDate   string // YYYY-MM-DD
	Preset    string // "30d", "90d", "all"
	TenantID  *uint
}

// AnalyticsConstants contains shared constants for frontend/backend consistency
type AnalyticsConstants struct {
	MinReliabilitySample int `json:"minReliabilitySample"`
	MinCorrelationSample int `json:"minCorrelationSample"`
	MinValiditySample    int `json:"minValiditySample"`
}

// AnalyticsResponse contains the full analytics data
type AnalyticsResponse struct {
	Summary           AnalyticsSummary         `json:"summary"`
	DimensionStats    map[string]DimensionStat `json:"dimensionStats"`
	Reliability       ReliabilityStats         `json:"reliability"`
	Validity          ValidityStats            `json:"validity"`
	GroupComparison   GroupComparisonData      `json:"groupComparison"`
	Trends            TrendData                `json:"trends"`
	Segments          SegmentData              `json:"segments"`
	CorrelationMatrix map[string]float64       `json:"correlationMatrix"`
	Constants         AnalyticsConstants       `json:"constants"`
}

// GroupComparisonData contains statistical comparisons between groups
type GroupComparisonData struct {
	ByDevice           map[string]DimensionComparison `json:"byDevice"`           // mobile vs desktop per dimension
	ByLanguage         map[string]DimensionComparison `json:"byLanguage"`         // zh-CN vs en per dimension
	MinSample          int                            `json:"minSample"`          // Minimum sample per group required
	ExcludedDimensions []ExcludedDimensionInfo        `json:"excludedDimensions"` // Dimensions excluded and why
	Debug              *GroupComparisonDebug          `json:"debug,omitempty"`    // Debug info for troubleshooting
}

// GroupComparisonDebug contains diagnostic info for troubleshooting
type GroupComparisonDebug struct {
	TotalResults          int                       `json:"totalResults"`
	ParseErrors           int                       `json:"parseErrors"`
	LanguageCounts        map[string]int            `json:"languageCounts"`        // How many results per language
	DimensionsByLang      map[string]map[string]int `json:"dimensionsByLang"`      // lang -> dim -> count
	RecordsWithMissingDim []MissingDimRecord        `json:"recordsWithMissingDim"` // Records missing some dimensions
}

// MissingDimRecord identifies a record with incomplete dimensions
type MissingDimRecord struct {
	ID              uint     `json:"id"`
	Language        string   `json:"language"`
	MissingDims     []string `json:"missingDims"`
	PresentDims     []string `json:"presentDims"`
}

// ExcludedDimensionInfo explains why a dimension was excluded from group comparison
type ExcludedDimensionInfo struct {
	Dimension   string            `json:"dimension"`
	Reason      string            `json:"reason"`
	GroupCounts map[string]int    `json:"groupCounts"` // How many samples each group has
}

// DimensionComparison contains comparison stats for a single dimension
type DimensionComparison struct {
	Groups      []GroupStats `json:"groups"`      // Stats for each group
	TTest       *TTestStats  `json:"tTest"`       // For 2 groups
	ANOVA       *ANOVAStats  `json:"anova"`       // For 3+ groups
	EffectSize  EffectStats  `json:"effectSize"`  // Cohen's d or Eta-squared
	Significant bool         `json:"significant"` // p < 0.05
}

// GroupStats contains descriptive stats for a single group
type GroupStats struct {
	Name   string  `json:"name"`
	Count  int     `json:"count"`
	Mean   float64 `json:"mean"`
	StdDev float64 `json:"stdDev"`
}

// TTestStats contains t-test results
type TTestStats struct {
	Statistic float64 `json:"statistic"`
	DF        float64 `json:"df"`
	PValue    float64 `json:"pValue"`
}

// ANOVAStats contains ANOVA results
type ANOVAStats struct {
	FStatistic float64 `json:"fStatistic"`
	DfBetween  int     `json:"dfBetween"`
	DfWithin   int     `json:"dfWithin"`
	PValue     float64 `json:"pValue"`
}

// EffectStats contains effect size measures
type EffectStats struct {
	Value          float64 `json:"value"`          // Cohen's d or Eta-squared
	Type           string  `json:"type"`           // "cohensD" or "etaSquared"
	Interpretation string  `json:"interpretation"` // negligible, small, medium, large
}

// ValidityStats contains validity analysis results
type ValidityStats struct {
	HasSufficientSample  bool                       `json:"hasSufficientSample"`
	SampleSize           int                        `json:"sampleSize"`
	MinSampleSize        int                        `json:"minSampleSize"`
	ConvergentValidity   map[string]ConvergentStats `json:"convergentValidity"`   // AVE & CR by dimension
	DiscriminantValidity DiscriminantStats          `json:"discriminantValidity"` // Fornell-Larcker & HTMT
	OverallAssessment    ValidityAssessment         `json:"overallAssessment"`    // Summary interpretation
}

// ConvergentStats contains convergent validity metrics for a dimension
type ConvergentStats struct {
	AVE               float64 `json:"ave"`               // Average Variance Extracted (should be > 0.5)
	CR                float64 `json:"cr"`                // Composite Reliability (should be > 0.7)
	ItemCount         int     `json:"itemCount"`         // Number of items in this dimension
	MeetsAVEThreshold bool    `json:"meetsAVEThreshold"` // AVE >= 0.5
	MeetsCRThreshold  bool    `json:"meetsCRThreshold"`  // CR >= 0.7
}

// DiscriminantStats contains discriminant validity metrics
type DiscriminantStats struct {
	FornellLarcker       map[string]map[string]float64 `json:"fornellLarcker"` // sqrt(AVE) vs inter-correlations
	HTMT                 map[string]float64            `json:"htmt"`           // Heterotrait-Monotrait ratios
	PassesFornellLarcker bool                          `json:"passesFornellLarcker"`
	PassesHTMT           bool                          `json:"passesHTMT"` // All HTMT < 0.85
}

// ValidityAssessment provides an overall interpretation
type ValidityAssessment struct {
	ConvergentValid   bool   `json:"convergentValid"`   // All dimensions meet AVE > 0.5
	DiscriminantValid bool   `json:"discriminantValid"` // Passes Fornell-Larcker or HTMT
	OverallValid      bool   `json:"overallValid"`      // Both convergent and discriminant valid
	Interpretation    string `json:"interpretation"`    // Human-readable summary (en)
	InterpretationZh  string `json:"interpretationZh"`  // Human-readable summary (zh)
}

// AnalyticsSummary provides overview metrics
type AnalyticsSummary struct {
	TotalResponses int       `json:"totalResponses"`
	DateRange      DateRange `json:"dateRange"`
	QuestionCount  int       `json:"questionCount"`
}

// DateRange represents a date range
type DateRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// DimensionStat contains statistics for a single dimension
type DimensionStat struct {
	Mean         float64        `json:"mean"`
	StdDev       float64        `json:"stdDev"`
	Min          float64        `json:"min"`
	Max          float64        `json:"max"`
	Median       float64        `json:"median"`
	Distribution []Distribution `json:"distribution"`
}

// Distribution represents a histogram bin
type Distribution struct {
	Bin   string `json:"bin"` // e.g., "-5 to -4", "-4 to -3"
	Count int    `json:"count"`
}

// ReliabilityStats contains reliability analysis results
type ReliabilityStats struct {
	CronbachAlpha         float64                   `json:"cronbachAlpha"`
	ItemTotalCorrelations map[string]float64        `json:"itemTotalCorrelations"`
	SplitHalfReliability  float64                   `json:"splitHalfReliability"`
	SpearmanBrown         float64                   `json:"spearmanBrown"`
	SampleSize            int                       `json:"sampleSize"`
	MinSampleSize         int                       `json:"minSampleSize"`
	HasSufficientSample   bool                      `json:"hasSufficientSample"`
	ByDimension           map[string]DimReliability `json:"byDimension,omitempty"`
}

// DimReliability captures reliability metrics for a specific dimension/scale
type DimReliability struct {
	CronbachAlpha         float64            `json:"cronbachAlpha"`
	ItemTotalCorrelations map[string]float64 `json:"itemTotalCorrelations"`
	SplitHalfReliability  float64            `json:"splitHalfReliability"`
	SpearmanBrown         float64            `json:"spearmanBrown"`
	SampleSize            int                `json:"sampleSize"`
	HasSufficientSample   bool               `json:"hasSufficientSample"`
	QuestionCount         int                `json:"questionCount"`      // Total questions in dimension
	ValidQuestionCount    int                `json:"validQuestionCount"` // Questions with n complete responses
}

// TrendData contains time-based trend information
type TrendData struct {
	Daily   []TrendPoint `json:"daily"`
	Weekly  []TrendPoint `json:"weekly"`
	Monthly []TrendPoint `json:"monthly"`
}

// TrendPoint represents a single point in a trend
type TrendPoint struct {
	Date   string  `json:"date"`
	Count  int     `json:"count"`
	Change float64 `json:"change"` // Percentage change from previous period
}

// SegmentData contains segmented statistics
type SegmentData struct {
	ByRegion   []SegmentItem `json:"byRegion"`
	ByLanguage []SegmentItem `json:"byLanguage"`
	ByDevice   []SegmentItem `json:"byDevice"`
	ByChannel  []SegmentItem `json:"byChannel"`
	ByGlowtype []SegmentItem `json:"byGlowtype"`
}

// SegmentItem represents a segment with count
type SegmentItem struct {
	Name    string  `json:"name"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

// GetAnalytics calculates comprehensive analytics data with caching support
func (s *AnalyticsService) GetAnalytics(req AnalyticsRequest) (*AnalyticsResponse, error) {
	// Try to get from cache first
	if cache, err := s.cacheService.GetCached(req); err == nil {
		// Cache hit - unmarshal and return
		return s.cacheService.UnmarshalCache(cache)
	}

	// Cache miss - compute analytics
	return s.computeAndCacheAnalytics(req)
}

// GetAnalyticsForceRefresh bypasses cache and forces recomputation
func (s *AnalyticsService) GetAnalyticsForceRefresh(req AnalyticsRequest) (*AnalyticsResponse, error) {
	return s.computeAndCacheAnalytics(req)
}

// computeAndCacheAnalytics performs the actual computation and saves to cache
func (s *AnalyticsService) computeAndCacheAnalytics(req AnalyticsRequest) (*AnalyticsResponse, error) {
	startDate, endDate := s.resolveDateRange(req)

	// Build base query
	query := s.db.Model(&database.QuizResultDB{}).
		Where("created_at >= ? AND created_at <= ?", startDate, endDate+" 23:59:59")

	if req.TenantID != nil {
		query = query.Where("tenant_id = ? OR tenant_id IS NULL", *req.TenantID)
	} else {
		query = query.Where("tenant_id IS NULL")
	}

	// Fetch all results for analysis
	var results []database.QuizResultDB
	if err := query.Find(&results).Error; err != nil {
		return nil, err
	}

	// Get last result ID for cache tracking
	var lastResultID uint
	if len(results) > 0 {
		lastResultID = results[len(results)-1].ID
	}

	// Get question count
	var questionCount int64
	qQuery := s.db.Model(&database.QuizQuestionDB{}).Where("is_active = ?", true)
	if req.TenantID != nil {
		qQuery = qQuery.Where("tenant_id = ? OR tenant_id IS NULL", *req.TenantID)
	} else {
		qQuery = qQuery.Where("tenant_id IS NULL")
	}
	qQuery.Count(&questionCount)

	// Calculate all statistics
	dimensionStats := s.calculateDimensionStats(results)
	reliability := s.calculateReliability(results, req.TenantID)
	validity := s.calculateValidity(results, req.TenantID, reliability)
	groupComparison := s.calculateGroupComparison(results)
	trends := s.calculateTrends(results, startDate, endDate)
	segments := s.calculateSegments(results)
	correlationMatrix := s.calculateCorrelationMatrix(results)

	response := &AnalyticsResponse{
		Summary: AnalyticsSummary{
			TotalResponses: len(results),
			DateRange: DateRange{
				Start: startDate,
				End:   endDate,
			},
			QuestionCount: int(questionCount),
		},
		DimensionStats:    dimensionStats,
		Reliability:       reliability,
		Validity:          validity,
		GroupComparison:   groupComparison,
		Trends:            trends,
		Segments:          segments,
		CorrelationMatrix: correlationMatrix,
		Constants: AnalyticsConstants{
			MinReliabilitySample: minReliabilitySample,
			MinCorrelationSample: minCorrelationSample,
			MinValiditySample:    minValiditySample,
		},
	}

	// Save to cache asynchronously
	go func() {
		_ = s.cacheService.SaveCache(req, response, lastResultID)
	}()

	return response, nil
}

// InvalidateCache marks cache as stale for a tenant
func (s *AnalyticsService) InvalidateCache(tenantID *uint) error {
	return s.cacheService.MarkStale(tenantID)
}

// resolveDateRange converts preset or custom dates to actual date strings
func (s *AnalyticsService) resolveDateRange(req AnalyticsRequest) (string, string) {
	now := time.Now()
	endDate := now.Format("2006-01-02")

	// Highest priority: explicit custom range
	if req.StartDate != "" && req.EndDate != "" {
		return req.StartDate, req.EndDate
	}

	switch req.Preset {
	case "30d":
		return now.AddDate(0, 0, -30).Format("2006-01-02"), endDate
	case "90d":
		return now.AddDate(0, 0, -90).Format("2006-01-02"), endDate
	case "all":
		return "2000-01-01", endDate
	default:
		// Default to 30 days
		return now.AddDate(0, 0, -30).Format("2006-01-02"), endDate
	}
}

// calculateDimensionStats calculates statistics for each dimension
func (s *AnalyticsService) calculateDimensionStats(results []database.QuizResultDB) map[string]DimensionStat {
	stats := make(map[string]DimensionStat)
	if len(results) == 0 {
		return stats
	}

	// Collect scores by dimension
	dimScores := make(map[string][]float64)
	for _, r := range results {
		var scores map[string]float64
		if err := json.Unmarshal(r.DimensionScores, &scores); err != nil {
			continue
		}
		for dim, score := range scores {
			dimScores[dim] = append(dimScores[dim], score)
		}
	}

	// Calculate stats for each dimension
	for dim, scores := range dimScores {
		if len(scores) == 0 {
			continue
		}

		mean := calculateMean(scores)
		stdDev := calculateStdDev(scores, mean)
		min, max := findMinMax(scores)
		median := calculateMedian(scores)
		distribution := calculateDistribution(scores)

		stats[dim] = DimensionStat{
			Mean:         round2(mean),
			StdDev:       round2(stdDev),
			Min:          min,
			Max:          max,
			Median:       median,
			Distribution: distribution,
		}
	}

	return stats
}

// getQuestionDimensionMap returns a map of questionID -> dimension key (based on PrimaryDimensionID)
func (s *AnalyticsService) getQuestionDimensionMap(tenantID *uint) map[string]string {
	result := make(map[string]string)

	// Load dimensions (id -> key) for the tenant/global
	dimKeyByID := make(map[uint]string)
	var dims []database.TraitDimensionDB
	dq := s.db.Model(&database.TraitDimensionDB{})
	if tenantID != nil {
		dq = dq.Where("tenant_id = ? OR tenant_id IS NULL", *tenantID)
	} else {
		dq = dq.Where("tenant_id IS NULL")
	}
	dq.Find(&dims)
	for _, d := range dims {
		dimKeyByID[d.ID] = d.Key
	}

	// Load questions with primary dimension
	var questions []database.QuizQuestionDB
	qq := s.db.Select("question_id, primary_dimension_id, options").
		Model(&database.QuizQuestionDB{}).
		Where("is_active = ?", true)
	if tenantID != nil {
		qq = qq.Where("tenant_id = ? OR tenant_id IS NULL", *tenantID)
	} else {
		qq = qq.Where("tenant_id IS NULL")
	}
	qq.Find(&questions)
	for _, q := range questions {
		if q.PrimaryDimensionID != nil {
			if key, ok := dimKeyByID[*q.PrimaryDimensionID]; ok {
				result[q.QuestionID] = key
				continue
			}
		}

		// Fallback: derive dimension from option scores when primary dimension is missing
		if len(q.Options) > 0 {
			var opts []database.OptionConfig
			if err := json.Unmarshal(q.Options, &opts); err == nil {
				if dimKey := firstDimensionKeyFromOptions(opts); dimKey != "" {
					result[q.QuestionID] = dimKey
				}
			}
		}
	}
	return result
}

// firstDimensionKeyFromOptions returns a stable dimension key from option score definitions.
// This helps legacy data where PrimaryDimensionID is not populated.
func firstDimensionKeyFromOptions(opts []database.OptionConfig) string {
	for _, opt := range opts {
		if len(opt.Scores) == 0 {
			continue
		}
		keys := make([]string, 0, len(opt.Scores))
		for k := range opt.Scores {
			if k != "" {
				keys = append(keys, k)
			}
		}
		if len(keys) == 0 {
			continue
		}
		sort.Strings(keys)
		return keys[0]
	}
	return ""
}

// calculateReliability performs reliability analysis
func (s *AnalyticsService) calculateReliability(results []database.QuizResultDB, tenantID *uint) ReliabilityStats {
	stats := ReliabilityStats{
		ItemTotalCorrelations: make(map[string]float64),
		SampleSize:            len(results),
		MinSampleSize:         minReliabilitySample,
	}

	// Build question -> dimension key map (for per-dimension reliability)
	qDimMap := s.getQuestionDimensionMap(tenantID)

	// Parse answers to build item-level data
	itemScores := make(map[string][]float64) // questionId -> scores
	totalScores := make([]float64, 0, len(results))
	validResponses := 0

	// Per-dimension containers
	dimItemScores := make(map[string]map[string][]float64) // dimKey -> questionId -> scores
	dimTotalScores := make(map[string][]float64)           // dimKey -> totals per response

	for _, r := range results {
		var answers []database.AnswerRecord
		if err := json.Unmarshal(r.Answers, &answers); err != nil {
			continue
		}

		// Calculate total score for this response (sum of dimension scores)
		var dimScores map[string]float64
		if err := json.Unmarshal(r.DimensionScores, &dimScores); err != nil {
			continue
		}
		validResponses++
		total := 0.0
		for _, v := range dimScores {
			total += v
		}
		totalScores = append(totalScores, total)

		// Track item-level responses (using optionIndex as a numeric score)
		perDimTotals := make(map[string]float64)
		for _, ans := range answers {
			itemScores[ans.QuestionID] = append(itemScores[ans.QuestionID], float64(ans.OptionIndex))

			if dimKey, ok := qDimMap[ans.QuestionID]; ok && dimKey != "" {
				if _, exists := dimItemScores[dimKey]; !exists {
					dimItemScores[dimKey] = make(map[string][]float64)
				}
				dimItemScores[dimKey][ans.QuestionID] = append(dimItemScores[dimKey][ans.QuestionID], float64(ans.OptionIndex))
				perDimTotals[dimKey] += float64(ans.OptionIndex)
			}
		}

		// Append per-dimension totals for this response
		for dimKey, sum := range perDimTotals {
			dimTotalScores[dimKey] = append(dimTotalScores[dimKey], sum)
		}
	}

	stats.SampleSize = validResponses

	if len(itemScores) == 0 || stats.SampleSize < minReliabilitySample {
		return stats
	}

	stats.HasSufficientSample = true

	// Per-dimension reliability
	stats.ByDimension = make(map[string]DimReliability)
	for dimKey, dimItems := range dimItemScores {
		dTotals := dimTotalScores[dimKey]
		questionCount := len(dimItems)

		// Count questions with complete responses (len == sampleSize)
		validQuestionCount := 0
		for _, scores := range dimItems {
			if len(scores) == len(dTotals) {
				validQuestionCount++
			}
		}

		if len(dTotals) < minReliabilitySample {
			stats.ByDimension[dimKey] = DimReliability{
				SampleSize:         len(dTotals),
				HasSufficientSample: false,
				QuestionCount:      questionCount,
				ValidQuestionCount: validQuestionCount,
			}
			continue
		}
		alpha := s.calculateCronbachAlpha(dimItems, dTotals)
		itemCorrs := make(map[string]float64)
		for qID, scores := range dimItems {
			if len(scores) == len(dTotals) {
				itemCorrs[qID] = round3(calculatePearsonCorrelation(scores, dTotals))
			}
		}
		splitHalf, sb := s.calculateSplitHalfReliability(dimItems, len(dTotals))
		stats.ByDimension[dimKey] = DimReliability{
			CronbachAlpha:         alpha,
			ItemTotalCorrelations: itemCorrs,
			SplitHalfReliability:  splitHalf,
			SpearmanBrown:         sb,
			SampleSize:            len(dTotals),
			HasSufficientSample:   true,
			QuestionCount:         questionCount,
			ValidQuestionCount:    validQuestionCount,
		}
	}

	// Calculate Cronbach's Alpha
	stats.CronbachAlpha = s.calculateCronbachAlpha(itemScores, totalScores)

	// Calculate Item-Total Correlations
	for qID, scores := range itemScores {
		if len(scores) == len(totalScores) {
			corr := calculatePearsonCorrelation(scores, totalScores)
			stats.ItemTotalCorrelations[qID] = round3(corr)
		}
	}

	// Calculate Split-Half Reliability
	stats.SplitHalfReliability, stats.SpearmanBrown = s.calculateSplitHalfReliability(itemScores, len(totalScores))

	return stats
}

// calculateCronbachAlpha computes Cronbach's Alpha coefficient
// Formula: α = (k/(k-1)) * (1 - Σσ²ᵢ/σ²ₜ)
func (s *AnalyticsService) calculateCronbachAlpha(itemScores map[string][]float64, totalScores []float64) float64 {
	k := len(itemScores)
	if k < 2 || len(totalScores) < 2 {
		return 0
	}

	// Calculate sum of item variances
	sumItemVariance := 0.0
	for _, scores := range itemScores {
		if len(scores) > 1 {
			mean := calculateMean(scores)
			variance := calculateVariance(scores, mean)
			sumItemVariance += variance
		}
	}

	// Calculate total variance
	totalMean := calculateMean(totalScores)
	totalVariance := calculateVariance(totalScores, totalMean)

	if totalVariance == 0 {
		return 0
	}

	alpha := (float64(k) / float64(k-1)) * (1 - sumItemVariance/totalVariance)
	return round3(alpha)
}

// calculateSplitHalfReliability computes split-half reliability with Spearman-Brown correction
func (s *AnalyticsService) calculateSplitHalfReliability(itemScores map[string][]float64, n int) (float64, float64) {
	if len(itemScores) < 2 || n < 2 {
		return 0, 0
	}

	// CRITICAL FIX: First, filter to only include questions with complete responses
	validQIDs := make([]string, 0, len(itemScores))
	for qID, scores := range itemScores {
		if len(scores) == n {
			validQIDs = append(validQIDs, qID)
		}
	}

	// Need at least 2 valid questions for split-half
	if len(validQIDs) < 2 {
		return 0, 0
	}

	// Sort for consistent ordering
	sort.Strings(validQIDs)

	// Split into odd/even halves based on sorted order
	oddScores := make([]float64, n)
	evenScores := make([]float64, n)
	oddCount := 0
	evenCount := 0

	for i, qID := range validQIDs {
		scores := itemScores[qID]
		for j, score := range scores {
			if i%2 == 0 {
				evenScores[j] += score
			} else {
				oddScores[j] += score
			}
		}
		if i%2 == 0 {
			evenCount++
		} else {
			oddCount++
		}
	}

	// Ensure both halves have items (at least 1 each)
	if oddCount == 0 || evenCount == 0 {
		return 0, 0
	}

	// Calculate correlation between halves
	r := calculatePearsonCorrelation(oddScores, evenScores)

	// Spearman-Brown correction: r_sb = 2r / (1 + |r|)
	// Use absolute value to handle negative correlations correctly
	spearmanBrown := 0.0
	if r > -1 && r < 1 {
		spearmanBrown = (2 * r) / (1 + math.Abs(r))
	} else if r >= 1 {
		spearmanBrown = 1.0
	} else if r <= -1 {
		spearmanBrown = -1.0
	}

	return round3(r), round3(spearmanBrown)
}

// calculateTrends computes time-based trends
func (s *AnalyticsService) calculateTrends(results []database.QuizResultDB, startDate, endDate string) TrendData {
	trends := TrendData{
		Daily:   []TrendPoint{},
		Weekly:  []TrendPoint{},
		Monthly: []TrendPoint{},
	}

	if len(results) == 0 {
		return trends
	}

	// Group by date
	dailyCounts := make(map[string]int)
	for _, r := range results {
		date := r.CreatedAt.Format("2006-01-02")
		dailyCounts[date]++
	}

	// Convert to sorted array
	dates := make([]string, 0, len(dailyCounts))
	for date := range dailyCounts {
		dates = append(dates, date)
	}
	sort.Strings(dates)

	// Daily trends
	prevCount := 0
	for _, date := range dates {
		count := dailyCounts[date]
		change := 0.0
		if prevCount > 0 {
			change = round2((float64(count-prevCount) / float64(prevCount)) * 100)
		}
		trends.Daily = append(trends.Daily, TrendPoint{
			Date:   date,
			Count:  count,
			Change: change,
		})
		prevCount = count
	}

	// Weekly trends
	weeklyCounts := make(map[string]int)
	for _, r := range results {
		year, week := r.CreatedAt.ISOWeek()
		key := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).
			AddDate(0, 0, (week-1)*7).Format("2006-01-02")
		weeklyCounts[key]++
	}
	weeks := make([]string, 0, len(weeklyCounts))
	for w := range weeklyCounts {
		weeks = append(weeks, w)
	}
	sort.Strings(weeks)
	prevCount = 0
	for _, week := range weeks {
		count := weeklyCounts[week]
		change := 0.0
		if prevCount > 0 {
			change = round2((float64(count-prevCount) / float64(prevCount)) * 100)
		}
		trends.Weekly = append(trends.Weekly, TrendPoint{
			Date:   week,
			Count:  count,
			Change: change,
		})
		prevCount = count
	}

	// Monthly trends
	monthlyCounts := make(map[string]int)
	for _, r := range results {
		month := r.CreatedAt.Format("2006-01")
		monthlyCounts[month]++
	}
	months := make([]string, 0, len(monthlyCounts))
	for m := range monthlyCounts {
		months = append(months, m)
	}
	sort.Strings(months)
	prevCount = 0
	for _, month := range months {
		count := monthlyCounts[month]
		change := 0.0
		if prevCount > 0 {
			change = round2((float64(count-prevCount) / float64(prevCount)) * 100)
		}
		trends.Monthly = append(trends.Monthly, TrendPoint{
			Date:   month,
			Count:  count,
			Change: change,
		})
		prevCount = count
	}

	return trends
}

// calculateSegments computes segmented statistics
func (s *AnalyticsService) calculateSegments(results []database.QuizResultDB) SegmentData {
	segments := SegmentData{
		ByRegion:   []SegmentItem{},
		ByLanguage: []SegmentItem{},
		ByDevice:   []SegmentItem{},
		ByChannel:  []SegmentItem{},
		ByGlowtype: []SegmentItem{},
	}

	if len(results) == 0 {
		return segments
	}

	total := float64(len(results))

	// Count by each segment
	regionCounts := make(map[string]int)
	langCounts := make(map[string]int)
	deviceCounts := make(map[string]int)
	channelCounts := make(map[string]int)
	typeCounts := make(map[string]int)

	for _, r := range results {
		region := r.Region
		if region == "" {
			region = "Unknown"
		}
		regionCounts[region]++

		lang := r.Language
		if lang == "" {
			lang = "Unknown"
		}
		langCounts[lang]++

		device := r.DeviceType
		if device == "" {
			device = "Unknown"
		}
		deviceCounts[device]++

		channel := r.Channel
		if channel == "" {
			channel = "organic"
		}
		channelCounts[channel]++

		if r.ResultTypeCode != "" {
			typeCounts[r.ResultTypeCode]++
		}
	}

	// Convert to SegmentItem arrays (sorted by count descending)
	segments.ByRegion = mapToSegmentItems(regionCounts, total)
	segments.ByLanguage = mapToSegmentItems(langCounts, total)
	segments.ByDevice = mapToSegmentItems(deviceCounts, total)
	segments.ByChannel = mapToSegmentItems(channelCounts, total)
	segments.ByGlowtype = mapToSegmentItems(typeCounts, total)

	return segments
}

// calculateCorrelationMatrix computes correlations between dimensions
func (s *AnalyticsService) calculateCorrelationMatrix(results []database.QuizResultDB) map[string]float64 {
	matrix := make(map[string]float64)

	if len(results) < minCorrelationSample {
		return matrix
	}

	// Collect dimension scores for each response and track dimension set
	dimSet := make(map[string]struct{})
	parsed := make([]map[string]float64, 0, len(results))
	for _, r := range results {
		var scores map[string]float64
		if err := json.Unmarshal(r.DimensionScores, &scores); err != nil {
			continue
		}
		if len(scores) == 0 {
			continue
		}
		parsed = append(parsed, scores)
		for dim := range scores {
			dimSet[dim] = struct{}{}
		}
	}

	if len(parsed) < minCorrelationSample {
		return matrix
	}

	// Get dimension names
	dims := make([]string, 0, len(dimSet))
	for dim := range dimSet {
		dims = append(dims, dim)
	}
	sort.Strings(dims)

	// Calculate pairwise correlations
	for i := 0; i < len(dims); i++ {
		for j := i + 1; j < len(dims); j++ {
			dim1, dim2 := dims[i], dims[j]

			// Build paired values only where both dimensions are present
			xs, ys := make([]float64, 0, len(parsed)), make([]float64, 0, len(parsed))
			for _, scores := range parsed {
				v1, ok1 := scores[dim1]
				v2, ok2 := scores[dim2]
				if ok1 && ok2 {
					xs = append(xs, v1)
					ys = append(ys, v2)
				}
			}

			if len(xs) >= minCorrelationSample {
				corr := calculatePearsonCorrelation(xs, ys)
				matrix[dim1+"_"+dim2] = round3(corr)
			}
		}
	}

	return matrix
}

// Helper functions

func calculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func calculateVariance(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}
	sumSq := 0.0
	for _, v := range values {
		diff := v - mean
		sumSq += diff * diff
	}
	return sumSq / float64(len(values)-1) // Sample variance (n-1)
}

func calculateStdDev(values []float64, mean float64) float64 {
	return math.Sqrt(calculateVariance(values, mean))
}

func findMinMax(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}
	min, max := values[0], values[0]
	for _, v := range values {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	return min, max
}

func calculateMedian(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	n := len(sorted)
	if n%2 == 0 {
		return (sorted[n/2-1] + sorted[n/2]) / 2
	}
	return sorted[n/2]
}

// calculateDistribution computes histogram using Freedman-Diaconis rule for optimal bin width
func calculateDistribution(values []float64) []Distribution {
	if len(values) == 0 {
		return []Distribution{}
	}

	// Sort values for percentile calculation
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	n := float64(len(sorted))
	minVal := sorted[0]
	maxVal := sorted[len(sorted)-1]

	// Handle edge case where all values are the same
	if minVal == maxVal {
		return []Distribution{{Bin: fmt.Sprintf("%.1f", minVal), Count: len(values)}}
	}

	// Calculate IQR using percentiles
	q1 := percentileFromSorted(sorted, 25)
	q3 := percentileFromSorted(sorted, 75)
	iqr := q3 - q1

	// Freedman-Diaconis rule: binWidth = 2 * IQR / n^(1/3)
	var binWidth float64
	if iqr > 0 {
		binWidth = 2.0 * iqr / math.Pow(n, 1.0/3.0)
	} else {
		// Fallback: use range / 10 if IQR is 0
		binWidth = (maxVal - minVal) / 10.0
	}

	// Calculate number of bins, constrained to [5, 15]
	numBins := int(math.Ceil((maxVal - minVal) / binWidth))
	if numBins < 5 {
		numBins = 5
	}
	if numBins > 15 {
		numBins = 15
	}

	// Recalculate actual bin width based on constrained numBins
	actualBinWidth := (maxVal - minVal) / float64(numBins)

	// Create bins and count values
	result := make([]Distribution, numBins)
	for i := 0; i < numBins; i++ {
		low := minVal + float64(i)*actualBinWidth
		high := low + actualBinWidth

		// Format bin label
		var label string
		if i == 0 {
			label = fmt.Sprintf("< %.1f", high)
		} else if i == numBins-1 {
			label = fmt.Sprintf("≥ %.1f", low)
		} else {
			label = fmt.Sprintf("%.1f ~ %.1f", low, high)
		}
		result[i] = Distribution{Bin: label, Count: 0}
	}

	// Assign values to bins
	for _, v := range values {
		idx := int((v - minVal) / actualBinWidth)
		// Handle edge case: value equals maxVal
		if idx >= numBins {
			idx = numBins - 1
		}
		if idx < 0 {
			idx = 0
		}
		result[idx].Count++
	}

	return result
}

// percentileFromSorted calculates percentile from a pre-sorted slice
func percentileFromSorted(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}

	// Linear interpolation method
	rank := (p / 100.0) * float64(len(sorted)-1)
	lower := int(math.Floor(rank))
	upper := int(math.Ceil(rank))
	if lower == upper {
		return sorted[lower]
	}
	frac := rank - float64(lower)
	return sorted[lower] + frac*(sorted[upper]-sorted[lower])
}

func calculatePearsonCorrelation(x, y []float64) float64 {
	if len(x) != len(y) || len(x) < 2 {
		return 0
	}

	n := float64(len(x))
	sumX, sumY := 0.0, 0.0
	sumXY, sumX2, sumY2 := 0.0, 0.0, 0.0

	for i := range x {
		sumX += x[i]
		sumY += y[i]
		sumXY += x[i] * y[i]
		sumX2 += x[i] * x[i]
		sumY2 += y[i] * y[i]
	}

	numerator := n*sumXY - sumX*sumY
	denominator := math.Sqrt((n*sumX2 - sumX*sumX) * (n*sumY2 - sumY*sumY))

	if denominator == 0 {
		return 0
	}

	return numerator / denominator
}

func mapToSegmentItems(counts map[string]int, total float64) []SegmentItem {
	items := make([]SegmentItem, 0, len(counts))
	for name, count := range counts {
		items = append(items, SegmentItem{
			Name:    name,
			Count:   count,
			Percent: round2(float64(count) / total * 100),
		})
	}

	// Sort by count descending
	sort.Slice(items, func(i, j int) bool {
		return items[i].Count > items[j].Count
	})

	return items
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func round3(v float64) float64 {
	return math.Round(v*1000) / 1000
}

// calculateValidity performs validity analysis (convergent and discriminant)
func (s *AnalyticsService) calculateValidity(results []database.QuizResultDB, tenantID *uint, reliability ReliabilityStats) ValidityStats {
	n := len(results)
	hasSufficient := n >= minValiditySample

	stats := ValidityStats{
		HasSufficientSample: hasSufficient,
		SampleSize:          n,
		MinSampleSize:       minValiditySample,
		ConvergentValidity:  make(map[string]ConvergentStats),
		DiscriminantValidity: DiscriminantStats{
			FornellLarcker:       make(map[string]map[string]float64),
			HTMT:                 make(map[string]float64),
			PassesFornellLarcker: false,
			PassesHTMT:           false,
		},
		OverallAssessment: ValidityAssessment{
			ConvergentValid:   false,
			DiscriminantValid: false,
			OverallValid:      false,
		},
	}

	if !hasSufficient || n == 0 {
		stats.OverallAssessment.Interpretation = fmt.Sprintf("Insufficient sample size. Need at least %d responses for validity analysis.", minValiditySample)
		stats.OverallAssessment.InterpretationZh = fmt.Sprintf("样本量不足。效度分析至少需要 %d 份有效答卷。", minValiditySample)
		return stats
	}

	// Get question-dimension mapping
	qDimMap := s.getQuestionDimensionMap(tenantID)

	// Collect item scores by dimension
	dimItemScores := make(map[string]map[string][]float64) // dimension -> questionID -> scores

	for _, r := range results {
		var answers map[string]int
		if err := json.Unmarshal(r.Answers, &answers); err != nil {
			continue
		}
		for qID, score := range answers {
			dimKey, ok := qDimMap[qID]
			if !ok {
				continue
			}
			if dimItemScores[dimKey] == nil {
				dimItemScores[dimKey] = make(map[string][]float64)
			}
			dimItemScores[dimKey][qID] = append(dimItemScores[dimKey][qID], float64(score))
		}
	}

	// Calculate convergent validity (AVE and CR) for each dimension
	aveByDim := make(map[string]float64)
	allAVEPass := true
	allCRPass := true

	for dimKey, itemScores := range dimItemScores {
		itemCount := len(itemScores)
		if itemCount < 2 {
			continue
		}

		// Calculate factor loadings (item-total correlations as proxy)
		// In proper factor analysis, these would be standardized factor loadings
		// Here we use item-total correlations within dimension as approximation
		var dimTotalScores []float64
		for i := 0; i < n; i++ {
			total := 0.0
			count := 0
			for _, scores := range itemScores {
				if i < len(scores) {
					total += scores[i]
					count++
				}
			}
			if count > 0 {
				dimTotalScores = append(dimTotalScores, total)
			}
		}

		var loadings []float64
		for _, scores := range itemScores {
			if len(scores) >= len(dimTotalScores) && len(dimTotalScores) > 0 {
				loading := calculatePearsonCorrelation(scores[:len(dimTotalScores)], dimTotalScores)
				if !math.IsNaN(loading) && loading > 0 {
					loadings = append(loadings, loading)
				}
			}
		}

		if len(loadings) < 2 {
			continue
		}

		// AVE = sum(loading^2) / n
		sumLoadingSq := 0.0
		for _, l := range loadings {
			sumLoadingSq += l * l
		}
		ave := sumLoadingSq / float64(len(loadings))

		// CR = (sum(loading))^2 / ((sum(loading))^2 + sum(1-loading^2))
		sumLoading := 0.0
		sumError := 0.0
		for _, l := range loadings {
			sumLoading += l
			sumError += (1 - l*l)
		}
		cr := (sumLoading * sumLoading) / (sumLoading*sumLoading + sumError)

		meetsAVE := ave >= 0.5
		meetsCR := cr >= 0.7

		if !meetsAVE {
			allAVEPass = false
		}
		if !meetsCR {
			allCRPass = false
		}

		aveByDim[dimKey] = ave
		stats.ConvergentValidity[dimKey] = ConvergentStats{
			AVE:               round3(ave),
			CR:                round3(cr),
			ItemCount:         itemCount,
			MeetsAVEThreshold: meetsAVE,
			MeetsCRThreshold:  meetsCR,
		}
	}

	// Calculate discriminant validity
	dims := make([]string, 0, len(aveByDim))
	for d := range aveByDim {
		dims = append(dims, d)
	}
	sort.Strings(dims)

	// Calculate dimension-level correlations for Fornell-Larcker
	dimScores := make(map[string][]float64)
	for _, r := range results {
		var scores map[string]float64
		if err := json.Unmarshal(r.DimensionScores, &scores); err != nil {
			continue
		}
		for dim, score := range scores {
			dimScores[dim] = append(dimScores[dim], score)
		}
	}

	// Fornell-Larcker criterion: sqrt(AVE) should be > inter-dimension correlations
	passesFornellLarcker := true
	for _, dim1 := range dims {
		stats.DiscriminantValidity.FornellLarcker[dim1] = make(map[string]float64)
		sqrtAVE := math.Sqrt(aveByDim[dim1])
		stats.DiscriminantValidity.FornellLarcker[dim1][dim1] = round3(sqrtAVE) // diagonal = sqrt(AVE)

		for _, dim2 := range dims {
			if dim1 >= dim2 {
				continue
			}
			scores1 := dimScores[dim1]
			scores2 := dimScores[dim2]
			minLen := len(scores1)
			if len(scores2) < minLen {
				minLen = len(scores2)
			}
			if minLen < 10 {
				continue
			}

			corr := calculatePearsonCorrelation(scores1[:minLen], scores2[:minLen])
			if math.IsNaN(corr) {
				continue
			}
			absCorr := math.Abs(corr)

			stats.DiscriminantValidity.FornellLarcker[dim1][dim2] = round3(corr)
			if stats.DiscriminantValidity.FornellLarcker[dim2] == nil {
				stats.DiscriminantValidity.FornellLarcker[dim2] = make(map[string]float64)
			}
			stats.DiscriminantValidity.FornellLarcker[dim2][dim1] = round3(corr)

			// Check Fornell-Larcker: sqrt(AVE) of both dimensions should be > |correlation|
			sqrtAVE1 := math.Sqrt(aveByDim[dim1])
			sqrtAVE2 := math.Sqrt(aveByDim[dim2])
			if sqrtAVE1 <= absCorr || sqrtAVE2 <= absCorr {
				passesFornellLarcker = false
			}

			// HTMT calculation (simplified)
			// HTMT = average(heterotrait-heteromethod correlations) / sqrt(average(monotrait-heteromethod correlations))
			// Simplified: use |inter-dimension correlation| as HTMT proxy
			htmtKey := fmt.Sprintf("%s_%s", dim1, dim2)
			stats.DiscriminantValidity.HTMT[htmtKey] = round3(absCorr)
		}
	}

	// Check HTMT threshold (< 0.85 is acceptable, < 0.90 is lenient)
	passesHTMT := true
	for _, htmt := range stats.DiscriminantValidity.HTMT {
		if htmt >= 0.85 {
			passesHTMT = false
			break
		}
	}

	stats.DiscriminantValidity.PassesFornellLarcker = passesFornellLarcker
	stats.DiscriminantValidity.PassesHTMT = passesHTMT

	// Overall assessment
	convergentValid := allAVEPass && allCRPass && len(stats.ConvergentValidity) > 0
	discriminantValid := (passesFornellLarcker || passesHTMT) && len(dims) > 1

	stats.OverallAssessment.ConvergentValid = convergentValid
	stats.OverallAssessment.DiscriminantValid = discriminantValid
	stats.OverallAssessment.OverallValid = convergentValid && discriminantValid

	// Generate interpretation
	stats.OverallAssessment.Interpretation = s.generateValidityInterpretation(stats, false)
	stats.OverallAssessment.InterpretationZh = s.generateValidityInterpretation(stats, true)

	return stats
}

// generateValidityInterpretation creates human-readable validity assessment
func (s *AnalyticsService) generateValidityInterpretation(stats ValidityStats, isZh bool) string {
	if !stats.HasSufficientSample {
		if isZh {
			return fmt.Sprintf("样本量不足（当前 %d，需要 %d）。效度分析需要更多数据。", stats.SampleSize, stats.MinSampleSize)
		}
		return fmt.Sprintf("Insufficient sample size (%d, need %d). Validity analysis requires more data.", stats.SampleSize, stats.MinSampleSize)
	}

	var parts []string

	// Convergent validity
	avePass := 0
	aveTotal := len(stats.ConvergentValidity)
	for _, cv := range stats.ConvergentValidity {
		if cv.MeetsAVEThreshold {
			avePass++
		}
	}

	if isZh {
		if aveTotal == 0 {
			parts = append(parts, "无法计算聚合效度（维度数据不足）")
		} else if avePass == aveTotal {
			parts = append(parts, fmt.Sprintf("聚合效度良好：所有 %d 个维度的 AVE ≥ 0.5", aveTotal))
		} else {
			parts = append(parts, fmt.Sprintf("聚合效度存在问题：%d/%d 个维度的 AVE < 0.5", aveTotal-avePass, aveTotal))
		}

		// Discriminant validity
		if len(stats.DiscriminantValidity.HTMT) == 0 {
			parts = append(parts, "无法计算区分效度（需要至少2个维度）")
		} else if stats.DiscriminantValidity.PassesHTMT {
			parts = append(parts, "区分效度良好：所有维度间 HTMT < 0.85")
		} else {
			parts = append(parts, "区分效度存在问题：部分维度间相关性过高（HTMT ≥ 0.85）")
		}
	} else {
		if aveTotal == 0 {
			parts = append(parts, "Cannot compute convergent validity (insufficient dimension data)")
		} else if avePass == aveTotal {
			parts = append(parts, fmt.Sprintf("Good convergent validity: All %d dimensions have AVE ≥ 0.5", aveTotal))
		} else {
			parts = append(parts, fmt.Sprintf("Convergent validity concern: %d/%d dimensions have AVE < 0.5", aveTotal-avePass, aveTotal))
		}

		// Discriminant validity
		if len(stats.DiscriminantValidity.HTMT) == 0 {
			parts = append(parts, "Cannot compute discriminant validity (need at least 2 dimensions)")
		} else if stats.DiscriminantValidity.PassesHTMT {
			parts = append(parts, "Good discriminant validity: All inter-dimension HTMT < 0.85")
		} else {
			parts = append(parts, "Discriminant validity concern: Some dimensions are too highly correlated (HTMT ≥ 0.85)")
		}
	}

	return fmt.Sprintf("%s", joinStrings(parts, "; "))
}

func joinStrings(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}

const minGroupComparisonSample = 10 // Minimum sample per group for comparison

// calculateGroupComparison performs t-tests and ANOVA for group comparisons
func (s *AnalyticsService) calculateGroupComparison(results []database.QuizResultDB) GroupComparisonData {
	data := GroupComparisonData{
		ByDevice:           make(map[string]DimensionComparison),
		ByLanguage:         make(map[string]DimensionComparison),
		MinSample:          minGroupComparisonSample,
		ExcludedDimensions: []ExcludedDimensionInfo{},
	}

	// Initialize debug info
	debug := &GroupComparisonDebug{
		TotalResults:          len(results),
		ParseErrors:           0,
		LanguageCounts:        make(map[string]int),
		DimensionsByLang:      make(map[string]map[string]int),
		RecordsWithMissingDim: []MissingDimRecord{},
	}

	if len(results) < minGroupComparisonSample*2 {
		data.Debug = debug
		return data
	}

	calc := NewStatisticsCalculator()

	// First pass: collect all dimension names
	allDimensions := make(map[string]bool)
	parsedResults := make([]struct {
		result    database.QuizResultDB
		dimScores map[string]float64
		lang      string
	}, 0, len(results))

	for _, r := range results {
		var dimScores map[string]float64
		if err := json.Unmarshal(r.DimensionScores, &dimScores); err != nil {
			debug.ParseErrors++
			continue
		}
		for dim := range dimScores {
			allDimensions[dim] = true
		}

		// Determine language
		lang := r.Language
		if lang == "" {
			lang = "unknown"
		}
		if len(lang) > 2 && (lang[:2] == "zh" || lang[:2] == "en") {
			lang = lang[:2]
		}

		parsedResults = append(parsedResults, struct {
			result    database.QuizResultDB
			dimScores map[string]float64
			lang      string
		}{r, dimScores, lang})
	}

	// Collect dimension scores by device type
	deviceScores := make(map[string]map[string][]float64) // device -> dimension -> scores
	langScores := make(map[string]map[string][]float64)   // language -> dimension -> scores

	for _, pr := range parsedResults {
		r := pr.result
		dimScores := pr.dimScores
		lang := pr.lang

		// Check for missing dimensions
		var missingDims []string
		var presentDims []string
		for dim := range allDimensions {
			if _, exists := dimScores[dim]; exists {
				presentDims = append(presentDims, dim)
			} else {
				missingDims = append(missingDims, dim)
			}
		}
		if len(missingDims) > 0 {
			debug.RecordsWithMissingDim = append(debug.RecordsWithMissingDim, MissingDimRecord{
				ID:          r.ID,
				Language:    lang,
				MissingDims: missingDims,
				PresentDims: presentDims,
			})
		}

		// Group by device
		device := "desktop"
		if r.DeviceType == "mobile" || r.DeviceType == "tablet" {
			device = "mobile"
		}
		if deviceScores[device] == nil {
			deviceScores[device] = make(map[string][]float64)
		}
		for dim, score := range dimScores {
			deviceScores[device][dim] = append(deviceScores[device][dim], score)
		}

		// Group by language
		if langScores[lang] == nil {
			langScores[lang] = make(map[string][]float64)
		}
		for dim, score := range dimScores {
			langScores[lang][dim] = append(langScores[lang][dim], score)
		}

		// Track debug info
		debug.LanguageCounts[lang]++
	}

	// Build dimensionsByLang for debug
	for lang, dimMap := range langScores {
		if debug.DimensionsByLang[lang] == nil {
			debug.DimensionsByLang[lang] = make(map[string]int)
		}
		for dim, scores := range dimMap {
			debug.DimensionsByLang[lang][dim] = len(scores)
		}
	}

	// Compare by device (mobile vs desktop)
	deviceResult := s.compareGroups(deviceScores, calc)
	data.ByDevice = deviceResult.Comparisons

	// Compare by language (zh vs en)
	langResult := s.compareGroups(langScores, calc)
	data.ByLanguage = langResult.Comparisons

	// Merge excluded dimensions (prioritize language exclusions as they're more common)
	data.ExcludedDimensions = langResult.Excluded
	data.Debug = debug

	return data
}

// CompareGroupsResult contains both comparison results and excluded dimensions
type CompareGroupsResult struct {
	Comparisons map[string]DimensionComparison
	Excluded    []ExcludedDimensionInfo
}

// compareGroups performs statistical comparison between groups for each dimension
func (s *AnalyticsService) compareGroups(groupScores map[string]map[string][]float64, calc *StatisticsCalculator) CompareGroupsResult {
	result := CompareGroupsResult{
		Comparisons: make(map[string]DimensionComparison),
		Excluded:    []ExcludedDimensionInfo{},
	}

	// Get all dimensions
	dims := make(map[string]bool)
	for _, dimMap := range groupScores {
		for dim := range dimMap {
			dims[dim] = true
		}
	}

	// For each dimension, compare groups
	for dim := range dims {
		var groups []GroupStats
		var groupData [][]float64
		groupNames := make([]string, 0)

		// Track all group counts for exclusion info
		groupCounts := make(map[string]int)

		for groupName, dimMap := range groupScores {
			scores := dimMap[dim]
			groupCounts[groupName] = len(scores)

			if len(scores) < minGroupComparisonSample {
				continue
			}

			mean := calculateMean(scores)
			stdDev := calculateStdDev(scores, mean)
			groups = append(groups, GroupStats{
				Name:   groupName,
				Count:  len(scores),
				Mean:   round2(mean),
				StdDev: round2(stdDev),
			})
			groupData = append(groupData, scores)
			groupNames = append(groupNames, groupName)
		}

		if len(groups) < 2 {
			// Record why this dimension was excluded
			result.Excluded = append(result.Excluded, ExcludedDimensionInfo{
				Dimension:   dim,
				Reason:      "insufficient_groups",
				GroupCounts: groupCounts,
			})
			continue
		}

		comparison := DimensionComparison{
			Groups: groups,
		}

		if len(groups) == 2 {
			// Use t-test for 2 groups
			tResult := calc.TTest(groupData[0], groupData[1])
			comparison.TTest = &TTestStats{
				Statistic: tResult.Statistic,
				DF:        tResult.DegreesOfFree,
				PValue:    tResult.PValue,
			}
			comparison.Significant = tResult.IsSignificant

			// Cohen's d for effect size
			d := calc.CohensD(groupData[0], groupData[1])
			comparison.EffectSize = EffectStats{
				Value:          round3(math.Abs(d)),
				Type:           "cohensD",
				Interpretation: calc.InterpretCohensD(d),
			}
		} else {
			// Use ANOVA for 3+ groups
			anovaResult := calc.OneWayANOVA(groupData)
			comparison.ANOVA = &ANOVAStats{
				FStatistic: anovaResult.FStatistic,
				DfBetween:  anovaResult.DfBetween,
				DfWithin:   anovaResult.DfWithin,
				PValue:     anovaResult.PValue,
			}
			comparison.Significant = anovaResult.IsSignificant

			// Eta-squared for effect size
			eta2 := calc.EtaSquared(groupData)
			comparison.EffectSize = EffectStats{
				Value:          round3(eta2),
				Type:           "etaSquared",
				Interpretation: calc.InterpretEtaSquared(eta2),
			}
		}

		result.Comparisons[dim] = comparison
	}

	return result
}

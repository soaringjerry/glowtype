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
	db *gorm.DB
}

const (
	minReliabilitySample = 30
	minCorrelationSample = 15
)

// NewAnalyticsService creates a new analytics service
func NewAnalyticsService(db *gorm.DB) *AnalyticsService {
	return &AnalyticsService{db: db}
}

// AnalyticsRequest contains parameters for analytics queries
type AnalyticsRequest struct {
	StartDate string // YYYY-MM-DD
	EndDate   string // YYYY-MM-DD
	Preset    string // "30d", "90d", "all"
	TenantID  *uint
}

// AnalyticsResponse contains the full analytics data
type AnalyticsResponse struct {
	Summary           AnalyticsSummary         `json:"summary"`
	DimensionStats    map[string]DimensionStat `json:"dimensionStats"`
	Reliability       ReliabilityStats         `json:"reliability"`
	Trends            TrendData                `json:"trends"`
	Segments          SegmentData              `json:"segments"`
	CorrelationMatrix map[string]float64       `json:"correlationMatrix"`
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

// GetAnalytics calculates comprehensive analytics data
func (s *AnalyticsService) GetAnalytics(req AnalyticsRequest) (*AnalyticsResponse, error) {
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
	trends := s.calculateTrends(results, startDate, endDate)
	segments := s.calculateSegments(results)
	correlationMatrix := s.calculateCorrelationMatrix(results)

	return &AnalyticsResponse{
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
		Trends:            trends,
		Segments:          segments,
		CorrelationMatrix: correlationMatrix,
	}, nil
}

// resolveDateRange converts preset or custom dates to actual date strings
func (s *AnalyticsService) resolveDateRange(req AnalyticsRequest) (string, string) {
	now := time.Now()
	endDate := now.Format("2006-01-02")

	switch req.Preset {
	case "30d":
		return now.AddDate(0, 0, -30).Format("2006-01-02"), endDate
	case "90d":
		return now.AddDate(0, 0, -90).Format("2006-01-02"), endDate
	case "all":
		return "2000-01-01", endDate
	default:
		// Custom dates
		if req.StartDate != "" && req.EndDate != "" {
			return req.StartDate, req.EndDate
		}
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
	qq := s.db.Select("question_id, primary_dimension_id").Model(&database.QuizQuestionDB{}).Where("is_active = ?", true)
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
			}
		}
	}
	return result
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
		if len(dTotals) < minReliabilitySample {
			stats.ByDimension[dimKey] = DimReliability{
				SampleSize:          len(dTotals),
				HasSufficientSample: false,
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

	// Sort question IDs for consistent ordering
	qIDs := make([]string, 0, len(itemScores))
	for qID := range itemScores {
		qIDs = append(qIDs, qID)
	}
	sort.Strings(qIDs)

	// Split into odd/even halves
	oddScores := make([]float64, n)
	evenScores := make([]float64, n)

	for i, qID := range qIDs {
		scores := itemScores[qID]
		if len(scores) != n {
			continue
		}
		for j, score := range scores {
			if i%2 == 0 {
				evenScores[j] += score
			} else {
				oddScores[j] += score
			}
		}
	}

	// Calculate correlation between halves
	r := calculatePearsonCorrelation(oddScores, evenScores)

	// Spearman-Brown correction: r_sb = 2r / (1 + r)
	spearmanBrown := 0.0
	if r > -1 {
		spearmanBrown = (2 * r) / (1 + r)
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

func calculateDistribution(values []float64) []Distribution {
	if len(values) == 0 {
		return []Distribution{}
	}

	// Create bins from -6 to 6 with width 1
	bins := make(map[string]int)
	binLabels := []string{}
	for i := -6; i <= 5; i++ {
		label := ""
		if i == -6 {
			label = "< -5"
		} else if i == 5 {
			label = "> 4"
		} else {
			label = formatBin(i, i+1)
		}
		binLabels = append(binLabels, label)
		bins[label] = 0
	}

	// Count values in each bin
	for _, v := range values {
		var label string
		if v < -5 {
			label = "< -5"
		} else if v >= 5 {
			label = "> 4"
		} else {
			binIdx := int(math.Floor(v)) + 5 // -5 -> 0, -4 -> 1, etc.
			if binIdx < 0 {
				binIdx = 0
			}
			if binIdx >= len(binLabels)-1 {
				binIdx = len(binLabels) - 2
			}
			label = binLabels[binIdx+1]
		}
		bins[label]++
	}

	// Convert to array
	result := make([]Distribution, 0, len(binLabels))
	for _, label := range binLabels {
		result = append(result, Distribution{
			Bin:   label,
			Count: bins[label],
		})
	}

	return result
}

func formatBin(low, high int) string {
	return fmt.Sprintf("%d to %d", low, high)
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

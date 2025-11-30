package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
)

// CrisisAnalyticsResponse contains aggregated crisis event data for research
// Note: This only provides aggregate trends, not individual-level data
type CrisisAnalyticsResponse struct {
	Summary       CrisisSummary          `json:"summary"`
	ByLevel       []LevelCount           `json:"byLevel"`
	ByCategory    []CategoryCount        `json:"byCategory"`
	ByGlowtype    []GlowtypeCount        `json:"byGlowtype"`
	ByLanguage    []LanguageCount        `json:"byLanguage"`
	DailyTrend    []DailyTrendPoint      `json:"dailyTrend"`
	WeeklyTrend   []WeeklyTrendPoint     `json:"weeklyTrend"`
	DetectionVia  []DetectionMethodCount `json:"detectionVia"`
	Insights      CrisisInsights         `json:"insights"`
}

// CrisisSummary provides overview metrics
type CrisisSummary struct {
	TotalEvents      int    `json:"totalEvents"`
	Level3Events     int    `json:"level3Events"`     // High risk count
	Level2Events     int    `json:"level2Events"`     // Moderate risk count
	UniqueSessions   int    `json:"uniqueSessions"`   // Distinct sessions with crisis
	DateRange        string `json:"dateRange"`        // e.g., "Last 30 days"
	AvgMessageIndex  float64 `json:"avgMessageIndex"` // When in conversation crisis typically occurs
}

// LevelCount counts events by risk level
type LevelCount struct {
	Level   int     `json:"level"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

// CategoryCount counts events by trigger category
type CategoryCount struct {
	Category string  `json:"category"`
	Count    int     `json:"count"`
	Percent  float64 `json:"percent"`
}

// GlowtypeCount counts events by glowtype
type GlowtypeCount struct {
	GlowtypeCode string  `json:"glowtypeCode"`
	Count        int     `json:"count"`
	Percent      float64 `json:"percent"`
}

// LanguageCount counts events by language
type LanguageCount struct {
	Language string  `json:"language"`
	Count    int     `json:"count"`
	Percent  float64 `json:"percent"`
}

// DailyTrendPoint represents daily crisis counts
type DailyTrendPoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// WeeklyTrendPoint represents weekly crisis counts
type WeeklyTrendPoint struct {
	Week  string `json:"week"`
	Count int    `json:"count"`
}

// DetectionMethodCount counts events by detection method
type DetectionMethodCount struct {
	Method  string  `json:"method"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

// CrisisInsights provides derived insights from the data
type CrisisInsights struct {
	MostCommonCategory     string  `json:"mostCommonCategory"`
	HighRiskRate           float64 `json:"highRiskRate"`           // Percent of Level 3
	AvgMessagesBeforeCrisis float64 `json:"avgMessagesBeforeCrisis"`
	PeakDay                string  `json:"peakDay"`                // Day with most events
	Interpretation         string  `json:"interpretation"`
	InterpretationZh       string  `json:"interpretationZh"`
}

// GetCrisisAnalyticsHandler returns aggregated crisis analytics
// GET /api/admin/stats/crisis
// Query params:
//   - preset: "7d", "30d", "90d", "all" (optional, defaults to 30d)
func GetCrisisAnalyticsHandler(c *gin.Context) {
	db := database.GetDB()

	preset := c.DefaultQuery("preset", "30d")
	startDate := getStartDateFromPreset(preset)

	// Query crisis events within date range
	var events []database.CrisisEventDB
	query := db.Model(&database.CrisisEventDB{}).
		Where("created_at >= ?", startDate)

	// Check for tenant context
	if tenantID, exists := c.Get("tenantID"); exists {
		if tid, ok := tenantID.(uint); ok {
			query = query.Where("tenant_id = ? OR tenant_id IS NULL", tid)
		}
	} else {
		query = query.Where("tenant_id IS NULL")
	}

	if err := query.Find(&events).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch crisis data"})
		return
	}

	response := buildCrisisAnalytics(events, preset)
	c.JSON(http.StatusOK, response)
}

func getStartDateFromPreset(preset string) time.Time {
	now := time.Now()
	switch preset {
	case "7d":
		return now.AddDate(0, 0, -7)
	case "30d":
		return now.AddDate(0, 0, -30)
	case "90d":
		return now.AddDate(0, 0, -90)
	case "all":
		return time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	default:
		return now.AddDate(0, 0, -30)
	}
}

func buildCrisisAnalytics(events []database.CrisisEventDB, preset string) CrisisAnalyticsResponse {
	total := len(events)
	if total == 0 {
		return CrisisAnalyticsResponse{
			Summary: CrisisSummary{
				DateRange: getDateRangeLabel(preset),
			},
			ByLevel:      []LevelCount{},
			ByCategory:   []CategoryCount{},
			ByGlowtype:   []GlowtypeCount{},
			ByLanguage:   []LanguageCount{},
			DailyTrend:   []DailyTrendPoint{},
			WeeklyTrend:  []WeeklyTrendPoint{},
			DetectionVia: []DetectionMethodCount{},
			Insights: CrisisInsights{
				Interpretation:   "No crisis events recorded in this period.",
				InterpretationZh: "该时间段内没有记录到危机事件。",
			},
		}
	}

	totalF := float64(total)

	// Count by level
	levelCounts := make(map[int]int)
	categoryCounts := make(map[string]int)
	glowtypeCounts := make(map[string]int)
	languageCounts := make(map[string]int)
	viaCounts := make(map[string]int)
	dailyCounts := make(map[string]int)
	weeklyCounts := make(map[string]int)
	sessionSet := make(map[string]bool)
	totalMessageIndex := 0

	for _, e := range events {
		levelCounts[e.RiskLevel]++

		cat := e.TriggerCategory
		if cat == "" {
			cat = "unknown"
		}
		categoryCounts[cat]++

		gt := e.GlowtypeCode
		if gt == "" {
			gt = "unknown"
		}
		glowtypeCounts[gt]++

		lang := e.Language
		if lang == "" {
			lang = "unknown"
		}
		languageCounts[lang]++

		via := e.Via
		if via == "" {
			via = "keyword"
		}
		viaCounts[via]++

		// Daily/weekly aggregation
		date := e.CreatedAt.Format("2006-01-02")
		dailyCounts[date]++

		year, week := e.CreatedAt.ISOWeek()
		weekKey := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).
			AddDate(0, 0, (week-1)*7).Format("2006-01-02")
		weeklyCounts[weekKey]++

		sessionSet[e.SessionID] = true
		totalMessageIndex += e.MessageIndex
	}

	// Build response arrays
	byLevel := make([]LevelCount, 0)
	for level := 1; level <= 3; level++ {
		count := levelCounts[level]
		byLevel = append(byLevel, LevelCount{
			Level:   level,
			Count:   count,
			Percent: round2Percent(float64(count) / totalF * 100),
		})
	}

	byCategory := mapToCategories(categoryCounts, totalF)
	byGlowtype := mapToGlowtypes(glowtypeCounts, totalF)
	byLanguage := mapToLanguages(languageCounts, totalF)
	detectionVia := mapToDetectionMethods(viaCounts, totalF)
	dailyTrend := mapToDailyTrend(dailyCounts)
	weeklyTrend := mapToWeeklyTrend(weeklyCounts)

	// Calculate insights
	avgMessageIndex := float64(totalMessageIndex) / totalF
	level3Count := levelCounts[3]
	highRiskRate := float64(level3Count) / totalF * 100

	// Find most common category
	mostCommonCategory := ""
	maxCatCount := 0
	for cat, count := range categoryCounts {
		if count > maxCatCount {
			maxCatCount = count
			mostCommonCategory = cat
		}
	}

	// Find peak day
	peakDay := ""
	maxDayCount := 0
	for day, count := range dailyCounts {
		if count > maxDayCount {
			maxDayCount = count
			peakDay = day
		}
	}

	interpretation := buildInterpretation(total, level3Count, avgMessageIndex, false)
	interpretationZh := buildInterpretation(total, level3Count, avgMessageIndex, true)

	return CrisisAnalyticsResponse{
		Summary: CrisisSummary{
			TotalEvents:     total,
			Level3Events:    level3Count,
			Level2Events:    levelCounts[2],
			UniqueSessions:  len(sessionSet),
			DateRange:       getDateRangeLabel(preset),
			AvgMessageIndex: round2Percent(avgMessageIndex),
		},
		ByLevel:      byLevel,
		ByCategory:   byCategory,
		ByGlowtype:   byGlowtype,
		ByLanguage:   byLanguage,
		DailyTrend:   dailyTrend,
		WeeklyTrend:  weeklyTrend,
		DetectionVia: detectionVia,
		Insights: CrisisInsights{
			MostCommonCategory:      mostCommonCategory,
			HighRiskRate:            round2Percent(highRiskRate),
			AvgMessagesBeforeCrisis: round2Percent(avgMessageIndex),
			PeakDay:                 peakDay,
			Interpretation:          interpretation,
			InterpretationZh:        interpretationZh,
		},
	}
}

func getDateRangeLabel(preset string) string {
	switch preset {
	case "7d":
		return "Last 7 days"
	case "30d":
		return "Last 30 days"
	case "90d":
		return "Last 90 days"
	case "all":
		return "All time"
	default:
		return "Last 30 days"
	}
}

func round2Percent(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

func mapToCategories(counts map[string]int, total float64) []CategoryCount {
	result := make([]CategoryCount, 0, len(counts))
	for cat, count := range counts {
		result = append(result, CategoryCount{
			Category: cat,
			Count:    count,
			Percent:  round2Percent(float64(count) / total * 100),
		})
	}
	return result
}

func mapToGlowtypes(counts map[string]int, total float64) []GlowtypeCount {
	result := make([]GlowtypeCount, 0, len(counts))
	for gt, count := range counts {
		result = append(result, GlowtypeCount{
			GlowtypeCode: gt,
			Count:        count,
			Percent:      round2Percent(float64(count) / total * 100),
		})
	}
	return result
}

func mapToLanguages(counts map[string]int, total float64) []LanguageCount {
	result := make([]LanguageCount, 0, len(counts))
	for lang, count := range counts {
		result = append(result, LanguageCount{
			Language: lang,
			Count:    count,
			Percent:  round2Percent(float64(count) / total * 100),
		})
	}
	return result
}

func mapToDetectionMethods(counts map[string]int, total float64) []DetectionMethodCount {
	result := make([]DetectionMethodCount, 0, len(counts))
	for method, count := range counts {
		result = append(result, DetectionMethodCount{
			Method:  method,
			Count:   count,
			Percent: round2Percent(float64(count) / total * 100),
		})
	}
	return result
}

func mapToDailyTrend(counts map[string]int) []DailyTrendPoint {
	result := make([]DailyTrendPoint, 0, len(counts))
	for date, count := range counts {
		result = append(result, DailyTrendPoint{
			Date:  date,
			Count: count,
		})
	}
	// Sort by date
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].Date > result[j].Date {
				result[i], result[j] = result[j], result[i]
			}
		}
	}
	return result
}

func mapToWeeklyTrend(counts map[string]int) []WeeklyTrendPoint {
	result := make([]WeeklyTrendPoint, 0, len(counts))
	for week, count := range counts {
		result = append(result, WeeklyTrendPoint{
			Week:  week,
			Count: count,
		})
	}
	// Sort by week
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].Week > result[j].Week {
				result[i], result[j] = result[j], result[i]
			}
		}
	}
	return result
}

func buildInterpretation(total, level3 int, avgMsgIndex float64, isZh bool) string {
	if isZh {
		if total == 0 {
			return "该时间段内没有记录到危机事件。"
		}
		level3Percent := float64(level3) / float64(total) * 100
		summary := ""
		if level3Percent > 20 {
			summary = "高风险事件比例偏高，建议审查关键词配置和响应策略。"
		} else if level3Percent > 10 {
			summary = "高风险事件比例处于中等水平，系统运行正常。"
		} else {
			summary = "高风险事件比例较低，系统运行良好。"
		}
		return summary
	}

	if total == 0 {
		return "No crisis events recorded in this period."
	}
	level3Percent := float64(level3) / float64(total) * 100
	summary := ""
	if level3Percent > 20 {
		summary = "High proportion of Level 3 events. Consider reviewing keyword configuration and response strategies."
	} else if level3Percent > 10 {
		summary = "Moderate proportion of high-risk events. System operating normally."
	} else {
		summary = "Low proportion of high-risk events. System operating well."
	}
	return summary
}

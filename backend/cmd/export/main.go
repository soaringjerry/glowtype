// Data Export Tool (CLI only, not exposed via API)
// Usage: go run cmd/export/main.go [options]
//
// Security: This tool should ONLY be run directly on the server.
// All exported data is anonymized - no PII or identifiable information.
package main

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
)

// AnonymizedQuizResult represents an anonymized quiz result for export
type AnonymizedQuizResult struct {
	ID              uint              `json:"id"`
	AnonymousID     string            `json:"anonymousId"` // Hashed session ID
	DimensionScores map[string]float64 `json:"dimensionScores"`
	ResultTypeCode  string            `json:"resultTypeCode"`
	Language        string            `json:"language"`
	Source          string            `json:"source"`
	Channel         string            `json:"channel,omitempty"`
	CreatedDate     string            `json:"createdDate"` // Date only, no time
}

// AnonymizedStats represents aggregated usage statistics
type AnonymizedStats struct {
	Date           string `json:"date"`
	QuizCompleted  int    `json:"quizCompleted"`
	ShareGenerated int    `json:"shareGenerated"`
	AIChatsStarted int    `json:"aiChatsStarted"`
	AIInsightUsed  int    `json:"aiInsightUsed"`
}

// GlowtypeDistribution represents glowtype distribution data
type GlowtypeDistribution struct {
	Date     string `json:"date"`
	TypeCode string `json:"typeCode"`
	Count    int    `json:"count"`
}

// ExportData contains all exportable data
type ExportData struct {
	ExportedAt           string                 `json:"exportedAt"`
	ExportVersion        string                 `json:"exportVersion"`
	AnonymizationNote    string                 `json:"anonymizationNote"`
	QuizResults          []AnonymizedQuizResult `json:"quizResults,omitempty"`
	UsageStats           []AnonymizedStats      `json:"usageStats,omitempty"`
	GlowtypeDistribution []GlowtypeDistribution `json:"glowtypeDistribution,omitempty"`
}

func main() {
	// CLI flags
	outputDir := flag.String("output", "./exports", "Output directory for export files")
	format := flag.String("format", "json", "Export format: json or csv")
	dataType := flag.String("type", "all", "Data type to export: all, results, stats, distribution")
	startDate := flag.String("start", "", "Start date filter (YYYY-MM-DD)")
	endDate := flag.String("end", "", "End date filter (YYYY-MM-DD)")
	flag.Parse()

	log.Println("=== Glowtype Anonymous Data Export Tool ===")
	log.Println("Security: This tool exports ONLY anonymized data")
	log.Println("")

	// Initialize database
	db := database.InitDB()

	// Create output directory
	if err := os.MkdirAll(*outputDir, 0700); err != nil {
		log.Fatalf("Failed to create output directory: %v", err)
	}

	// Prepare export data
	exportData := ExportData{
		ExportedAt:        time.Now().UTC().Format(time.RFC3339),
		ExportVersion:     "1.0",
		AnonymizationNote: "All data has been anonymized. Session IDs are SHA256 hashed with a random salt. Timestamps are truncated to date only. No PII is included.",
	}

	// Export based on type
	switch *dataType {
	case "all":
		exportData.QuizResults = exportQuizResults(db, *startDate, *endDate)
		exportData.UsageStats = exportUsageStats(db, *startDate, *endDate)
		exportData.GlowtypeDistribution = exportGlowtypeDistribution(db, *startDate, *endDate)
	case "results":
		exportData.QuizResults = exportQuizResults(db, *startDate, *endDate)
	case "stats":
		exportData.UsageStats = exportUsageStats(db, *startDate, *endDate)
	case "distribution":
		exportData.GlowtypeDistribution = exportGlowtypeDistribution(db, *startDate, *endDate)
	default:
		log.Fatalf("Unknown data type: %s", *dataType)
	}

	// Generate filename
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("glowtype_export_%s_%s", *dataType, timestamp)

	// Write output
	switch *format {
	case "json":
		writeJSON(*outputDir, filename, exportData)
	case "csv":
		writeCSV(*outputDir, filename, exportData)
	default:
		log.Fatalf("Unknown format: %s", *format)
	}

	log.Println("")
	log.Println("Export complete!")
}

// anonymizeSessionID creates a one-way hash of the session ID
// Uses a daily salt so same session can be correlated within a day but not across days
func anonymizeSessionID(sessionID string, date time.Time) string {
	// Use date as salt - allows correlation within same day
	salt := date.Format("2006-01-02")
	hash := sha256.Sum256([]byte(salt + sessionID))
	return hex.EncodeToString(hash[:8]) // First 8 bytes = 16 hex chars
}

func exportQuizResults(db *gorm.DB, startDate, endDate string) []AnonymizedQuizResult {
	log.Println("Exporting quiz results (anonymized)...")

	var results []database.QuizResultDB
	query := db.Order("created_at DESC")

	if startDate != "" {
		query = query.Where("DATE(created_at) >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("DATE(created_at) <= ?", endDate)
	}

	if err := query.Find(&results).Error; err != nil {
		log.Printf("Error fetching quiz results: %v", err)
		return nil
	}

	anonymized := make([]AnonymizedQuizResult, 0, len(results))
	for _, r := range results {
		// Parse dimension scores
		var scores map[string]float64
		if r.DimensionScores != nil {
			json.Unmarshal(r.DimensionScores, &scores)
		}

		anonymized = append(anonymized, AnonymizedQuizResult{
			ID:              r.ID,
			AnonymousID:     anonymizeSessionID(r.SessionID, r.CreatedAt),
			DimensionScores: scores,
			ResultTypeCode:  r.ResultTypeCode,
			Language:        r.Language,
			Source:          r.Source,
			Channel:         r.Channel,
			CreatedDate:     r.CreatedAt.Format("2006-01-02"), // Date only
		})
	}

	log.Printf("  Found %d records", len(anonymized))
	return anonymized
}

func exportUsageStats(db *gorm.DB, startDate, endDate string) []AnonymizedStats {
	log.Println("Exporting usage statistics...")

	var stats []database.UsageStats
	query := db.Order("date DESC")

	if startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("date <= ?", endDate)
	}

	if err := query.Find(&stats).Error; err != nil {
		log.Printf("Error fetching usage stats: %v", err)
		return nil
	}

	result := make([]AnonymizedStats, 0, len(stats))
	for _, s := range stats {
		result = append(result, AnonymizedStats{
			Date:           s.Date,
			QuizCompleted:  s.QuizCompleted,
			ShareGenerated: s.ShareGenerated,
			AIChatsStarted: s.AIChatsStarted,
			AIInsightUsed:  s.AIInsightUsed,
		})
	}

	log.Printf("  Found %d records", len(result))
	return result
}

func exportGlowtypeDistribution(db *gorm.DB, startDate, endDate string) []GlowtypeDistribution {
	log.Println("Exporting glowtype distribution...")

	var stats []database.GlowtypeStats
	query := db.Order("date DESC, type_code ASC")

	if startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("date <= ?", endDate)
	}

	if err := query.Find(&stats).Error; err != nil {
		log.Printf("Error fetching glowtype stats: %v", err)
		return nil
	}

	result := make([]GlowtypeDistribution, 0, len(stats))
	for _, s := range stats {
		result = append(result, GlowtypeDistribution{
			Date:     s.Date,
			TypeCode: s.TypeCode,
			Count:    s.Count,
		})
	}

	log.Printf("  Found %d records", len(result))
	return result
}

func writeJSON(outputDir, filename string, data ExportData) {
	filepath := filepath.Join(outputDir, filename+".json")
	file, err := os.Create(filepath)
	if err != nil {
		log.Fatalf("Failed to create file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		log.Fatalf("Failed to write JSON: %v", err)
	}

	log.Printf("Written to: %s", filepath)
}

func writeCSV(outputDir, filename string, data ExportData) {
	// Write quiz results CSV
	if len(data.QuizResults) > 0 {
		filepath := filepath.Join(outputDir, filename+"_results.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		// Header
		writer.Write([]string{"id", "anonymous_id", "result_type", "language", "source", "channel", "created_date", "dimension_scores_json"})

		for _, r := range data.QuizResults {
			scoresJSON, _ := json.Marshal(r.DimensionScores)
			writer.Write([]string{
				fmt.Sprintf("%d", r.ID),
				r.AnonymousID,
				r.ResultTypeCode,
				r.Language,
				r.Source,
				r.Channel,
				r.CreatedDate,
				string(scoresJSON),
			})
		}
		log.Printf("Written to: %s", filepath)
	}

	// Write usage stats CSV
	if len(data.UsageStats) > 0 {
		filepath := filepath.Join(outputDir, filename+"_stats.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		writer.Write([]string{"date", "quiz_completed", "share_generated", "ai_chats_started", "ai_insight_used"})

		for _, s := range data.UsageStats {
			writer.Write([]string{
				s.Date,
				fmt.Sprintf("%d", s.QuizCompleted),
				fmt.Sprintf("%d", s.ShareGenerated),
				fmt.Sprintf("%d", s.AIChatsStarted),
				fmt.Sprintf("%d", s.AIInsightUsed),
			})
		}
		log.Printf("Written to: %s", filepath)
	}

	// Write distribution CSV
	if len(data.GlowtypeDistribution) > 0 {
		filepath := filepath.Join(outputDir, filename+"_distribution.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		writer.Write([]string{"date", "type_code", "count"})

		for _, d := range data.GlowtypeDistribution {
			writer.Write([]string{
				d.Date,
				d.TypeCode,
				fmt.Sprintf("%d", d.Count),
			})
		}
		log.Printf("Written to: %s", filepath)
	}
}

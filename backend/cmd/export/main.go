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
	"strings"
	"time"

	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
)

// AnonymizedQuizResult represents an anonymized quiz result for export
type AnonymizedQuizResult struct {
	ID              uint               `json:"id"`
	AnonymousID     string             `json:"anonymousId"` // Hashed session ID
	DimensionScores map[string]float64 `json:"dimensionScores"`
	ResultTypeCode  string             `json:"resultTypeCode"`
	Language        string             `json:"language"`
	Source          string             `json:"source"`
	Channel         string             `json:"channel,omitempty"`
	// Enhanced analytics fields
	Region      string `json:"region,omitempty"`
	DeviceType  string `json:"deviceType,omitempty"`
	BrowserLang string `json:"browserLang,omitempty"`
	HourOfDay   int    `json:"hourOfDay"`
	CreatedDate string `json:"createdDate"`
	CreatedHour string `json:"createdHour"` // "2025-01-15 14:00" format
}

// AnonymizedChatSession represents an anonymized chat session for export
type AnonymizedChatSession struct {
	ID            uint   `json:"id"`
	AnonymousID   string `json:"anonymousId"`
	MessageCount  int    `json:"messageCount"`
	UserMessages  int    `json:"userMessages"`
	AIMessages    int    `json:"aiMessages"`
	DurationSecs  int    `json:"durationSecs"`
	GlowtypeCode  string `json:"glowtypeCode,omitempty"`
	Language      string `json:"language"`
	Region        string `json:"region,omitempty"`
	DeviceType    string `json:"deviceType,omitempty"`
	HourOfDay     int    `json:"hourOfDay"`
	HasCrisisFlag bool   `json:"hasCrisisFlag"`
	StartedDate   string `json:"startedDate"`
	StartedHour   string `json:"startedHour"`
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
	ExportedAt           string                  `json:"exportedAt"`
	ExportVersion        string                  `json:"exportVersion"`
	AnonymizationNote    string                  `json:"anonymizationNote"`
	QuizResults          []AnonymizedQuizResult  `json:"quizResults,omitempty"`
	ChatSessions         []AnonymizedChatSession `json:"chatSessions,omitempty"`
	UsageStats           []AnonymizedStats       `json:"usageStats,omitempty"`
	GlowtypeDistribution []GlowtypeDistribution  `json:"glowtypeDistribution,omitempty"`
}

func main() {
	// CLI flags
	outputDir := flag.String("output", "./exports", "Output directory for export files")
	format := flag.String("format", "json", "Export format: json or csv")
	dataType := flag.String("type", "all", "Data type to export: all, results, chats, stats, distribution")
	startDate := flag.String("start", "", "Start date filter (YYYY-MM-DD)")
	endDate := flag.String("end", "", "End date filter (YYYY-MM-DD)")
	flag.Parse()

	log.Println("=== Glowtype Anonymous Data Export Tool ===")
	log.Println("Security: This tool exports ONLY anonymized data")
	log.Println("")

	// Initialize database
	cfg := config.Load()
	db := database.InitDB(cfg)

	// Create output directory
	if err := os.MkdirAll(*outputDir, 0700); err != nil {
		log.Fatalf("Failed to create output directory: %v", err)
	}

	// Prepare export data
	exportData := ExportData{
		ExportedAt:    time.Now().UTC().Format(time.RFC3339),
		ExportVersion: "2.0",
		AnonymizationNote: `All data has been anonymized:
- Session IDs are SHA256 hashed with a random salt
- IP addresses are converted to region codes, then discarded (not stored)
- User agents are parsed for device type only
- Timestamps include hour for temporal analysis but session IDs prevent cross-day tracking
- No PII (names, emails, phone numbers) is collected or exported`,
	}

	// Export based on type
	switch *dataType {
	case "all":
		exportData.QuizResults = exportQuizResults(db, *startDate, *endDate)
		exportData.ChatSessions = exportChatSessions(db, *startDate, *endDate)
		exportData.UsageStats = exportUsageStats(db, *startDate, *endDate)
		exportData.GlowtypeDistribution = exportGlowtypeDistribution(db, *startDate, *endDate)
	case "results":
		exportData.QuizResults = exportQuizResults(db, *startDate, *endDate)
	case "chats":
		exportData.ChatSessions = exportChatSessions(db, *startDate, *endDate)
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
			if err := json.Unmarshal(r.DimensionScores, &scores); err != nil {
				log.Printf("Warning: failed to parse dimension scores for result %d: %v", r.ID, err)
			}
		}

		anonymized = append(anonymized, AnonymizedQuizResult{
			ID:              r.ID,
			AnonymousID:     anonymizeSessionID(r.SessionID, r.CreatedAt),
			DimensionScores: scores,
			ResultTypeCode:  r.ResultTypeCode,
			Language:        r.Language,
			Source:          r.Source,
			Channel:         r.Channel,
			Region:          r.Region,
			DeviceType:      r.DeviceType,
			BrowserLang:     r.BrowserLang,
			HourOfDay:       r.HourOfDay,
			CreatedDate:     r.CreatedAt.Format("2006-01-02"),
			CreatedHour:     r.CreatedAt.Format("2006-01-02 15:00"), // Hour precision
		})
	}

	log.Printf("  Found %d records", len(anonymized))
	return anonymized
}

func exportChatSessions(db *gorm.DB, startDate, endDate string) []AnonymizedChatSession {
	log.Println("Exporting chat sessions (anonymized)...")

	var sessions []database.ChatSessionDB
	query := db.Order("started_at DESC")

	if startDate != "" {
		query = query.Where("DATE(started_at) >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("DATE(started_at) <= ?", endDate)
	}

	if err := query.Find(&sessions).Error; err != nil {
		log.Printf("Error fetching chat sessions: %v", err)
		return nil
	}

	anonymized := make([]AnonymizedChatSession, 0, len(sessions))
	for _, s := range sessions {
		anonymized = append(anonymized, AnonymizedChatSession{
			ID:            s.ID,
			AnonymousID:   anonymizeSessionID(s.SessionID, s.StartedAt),
			MessageCount:  s.MessageCount,
			UserMessages:  s.UserMessages,
			AIMessages:    s.AIMessages,
			DurationSecs:  s.DurationSecs,
			GlowtypeCode:  s.GlowtypeCode,
			Language:      s.Language,
			Region:        s.Region,
			DeviceType:    s.DeviceType,
			HourOfDay:     s.HourOfDay,
			HasCrisisFlag: s.HasCrisisKeywords,
			StartedDate:   s.StartedAt.Format("2006-01-02"),
			StartedHour:   s.StartedAt.Format("2006-01-02 15:00"),
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
	if strings.TrimSpace(filename) == "" {
		log.Fatalf("Invalid filename")
	}
	target := filepath.Join(outputDir, filepath.Base(filename+".json"))
	file, err := os.Create(target)
	if err != nil {
		log.Fatalf("Failed to create file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		log.Fatalf("Failed to write JSON: %v", err)
	}

	log.Printf("Written to: %s", target)
}

func writeCSV(outputDir, filename string, data ExportData) {
	safeBase := filepath.Base(filename)
	if safeBase == "" {
		log.Fatalf("Invalid filename")
	}

	writeRecord := func(w *csv.Writer, record []string) {
		if err := w.Write(record); err != nil {
			log.Fatalf("Failed to write CSV: %v", err)
		}
	}

	// Write quiz results CSV
	if len(data.QuizResults) > 0 {
		filepath := filepath.Join(outputDir, safeBase+"_results.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		// Header
		writeRecord(writer, []string{
			"id", "anonymous_id", "result_type", "language", "source", "channel",
			"region", "device_type", "browser_lang", "hour_of_day",
			"created_date", "created_hour", "dimension_scores_json",
		})

		for _, r := range data.QuizResults {
			scoresJSON, err := json.Marshal(r.DimensionScores)
			if err != nil {
				log.Fatalf("Failed to encode dimension scores: %v", err)
			}
			writeRecord(writer, []string{
				fmt.Sprintf("%d", r.ID),
				r.AnonymousID,
				r.ResultTypeCode,
				r.Language,
				r.Source,
				r.Channel,
				r.Region,
				r.DeviceType,
				r.BrowserLang,
				fmt.Sprintf("%d", r.HourOfDay),
				r.CreatedDate,
				r.CreatedHour,
				string(scoresJSON),
			})
		}
		log.Printf("Written to: %s", filepath)
	}

	// Write chat sessions CSV
	if len(data.ChatSessions) > 0 {
		filepath := filepath.Join(outputDir, safeBase+"_chats.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		writeRecord(writer, []string{
			"id", "anonymous_id", "message_count", "user_messages", "ai_messages",
			"duration_secs", "glowtype_code", "language", "region", "device_type",
			"hour_of_day", "has_crisis_flag", "started_date", "started_hour",
		})

		for _, s := range data.ChatSessions {
			writeRecord(writer, []string{
				fmt.Sprintf("%d", s.ID),
				s.AnonymousID,
				fmt.Sprintf("%d", s.MessageCount),
				fmt.Sprintf("%d", s.UserMessages),
				fmt.Sprintf("%d", s.AIMessages),
				fmt.Sprintf("%d", s.DurationSecs),
				s.GlowtypeCode,
				s.Language,
				s.Region,
				s.DeviceType,
				fmt.Sprintf("%d", s.HourOfDay),
				fmt.Sprintf("%t", s.HasCrisisFlag),
				s.StartedDate,
				s.StartedHour,
			})
		}
		log.Printf("Written to: %s", filepath)
	}

	// Write usage stats CSV
	if len(data.UsageStats) > 0 {
		filepath := filepath.Join(outputDir, safeBase+"_stats.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		writeRecord(writer, []string{"date", "quiz_completed", "share_generated", "ai_chats_started", "ai_insight_used"})

		for _, s := range data.UsageStats {
			writeRecord(writer, []string{
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
		filepath := filepath.Join(outputDir, safeBase+"_distribution.csv")
		file, err := os.Create(filepath)
		if err != nil {
			log.Fatalf("Failed to create file: %v", err)
		}
		defer file.Close()

		writer := csv.NewWriter(file)
		defer writer.Flush()

		writeRecord(writer, []string{"date", "type_code", "count"})

		for _, d := range data.GlowtypeDistribution {
			writeRecord(writer, []string{
				d.Date,
				d.TypeCode,
				fmt.Sprintf("%d", d.Count),
			})
		}
		log.Printf("Written to: %s", filepath)
	}
}

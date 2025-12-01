package services

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/soaringjerry/glowtype/internal/database"

	"gorm.io/gorm"
)

const (
	// EmbeddingModel is the OpenAI embedding model to use
	EmbeddingModel = "text-embedding-3-large"
	// EmbeddingDimension is the dimension of text-embedding-3-large
	EmbeddingDimension = 3072
	// MinSimilarityScore is the minimum similarity threshold for retrieval
	MinSimilarityScore = 0.3
	// DefaultTopK is the default number of scripts to retrieve
	DefaultTopK = 3
)

// EmbeddingService handles OpenAI embedding generation and vector operations
type EmbeddingService struct {
	envAPIKey string // Fallback from environment
	envAPIURL string
	model     string
	dimension int
	db        *gorm.DB
}

// embeddingRequest is the OpenAI embedding API request format
type embeddingRequest struct {
	Input []string `json:"input"`
	Model string   `json:"model"`
}

// embeddingResponse is the OpenAI embedding API response format
type embeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(db *gorm.DB) *EmbeddingService {
	// Environment fallback: check AI_API_KEY first, then OPENAI_API_KEY
	envAPIKey := os.Getenv("AI_API_KEY")
	if envAPIKey == "" {
		envAPIKey = os.Getenv("OPENAI_API_KEY")
	}

	envAPIURL := os.Getenv("AI_API_URL")
	if envAPIURL == "" {
		envAPIURL = os.Getenv("OPENAI_BASE_URL")
	}
	if envAPIURL == "" {
		envAPIURL = "https://api.openai.com/v1"
	}

	model := os.Getenv("EMBEDDING_MODEL")
	if model == "" {
		model = EmbeddingModel
	}

	return &EmbeddingService{
		envAPIKey: envAPIKey,
		envAPIURL: envAPIURL,
		model:     model,
		dimension: EmbeddingDimension,
		db:        db,
	}
}

// GenerateEmbedding calls OpenAI API to generate embedding for text (L2 normalized)
func (s *EmbeddingService) GenerateEmbedding(text string) ([]float32, error) {
	if s.envAPIKey == "" {
		return nil, fmt.Errorf("AI API key not configured (set AI_API_KEY or OPENAI_API_KEY)")
	}

	if text == "" {
		return nil, fmt.Errorf("empty text")
	}

	reqBody := embeddingRequest{
		Input: []string{text},
		Model: s.model,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.envAPIURL+"/embeddings", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.envAPIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var embResp embeddingResponse
	if err := json.Unmarshal(body, &embResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if embResp.Error != nil {
		return nil, fmt.Errorf("OpenAI API error: %s", embResp.Error.Message)
	}

	if len(embResp.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	embedding := embResp.Data[0].Embedding

	// L2 normalize the embedding
	embedding = NormalizeL2(embedding)

	return embedding, nil
}

// UpdateScriptEmbedding generates and saves embedding for a script
func (s *EmbeddingService) UpdateScriptEmbedding(scriptID uint) error {
	var script database.CrisisScriptDB
	if err := s.db.First(&script, scriptID).Error; err != nil {
		return fmt.Errorf("script not found: %w", err)
	}

	// Choose text based on language
	text := script.Content
	if strings.HasPrefix(script.Language, "zh") && script.ContentZh != "" {
		text = script.ContentZh
	}

	// Combine title and content for better semantic representation
	title := script.Title
	if strings.HasPrefix(script.Language, "zh") && script.TitleZh != "" {
		title = script.TitleZh
	}
	fullText := title + "\n" + text

	embedding, err := s.GenerateEmbedding(fullText)
	if err != nil {
		return fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Serialize and save
	embeddingBlob := SerializeEmbedding(embedding)
	now := time.Now()

	if err := s.db.Model(&script).Updates(map[string]interface{}{
		"embedding":            embeddingBlob,
		"embedding_updated_at": now,
	}).Error; err != nil {
		return fmt.Errorf("failed to save embedding: %w", err)
	}

	log.Printf("[EmbeddingService] Updated embedding for script %d (%s)", scriptID, script.Title)
	return nil
}

// RefreshAllEmbeddings regenerates embeddings for all active scripts
func (s *EmbeddingService) RefreshAllEmbeddings() (int, int, error) {
	var scripts []database.CrisisScriptDB
	if err := s.db.Where("is_active = ?", true).Find(&scripts).Error; err != nil {
		return 0, 0, fmt.Errorf("failed to fetch scripts: %w", err)
	}

	success := 0
	failed := 0

	for _, script := range scripts {
		if err := s.UpdateScriptEmbedding(script.ID); err != nil {
			log.Printf("[EmbeddingService] Failed to update script %d: %v", script.ID, err)
			failed++
		} else {
			success++
		}
		// Rate limit: wait 100ms between requests
		time.Sleep(100 * time.Millisecond)
	}

	log.Printf("[EmbeddingService] Refresh complete: %d success, %d failed", success, failed)
	return success, failed, nil
}

// NormalizeL2 normalizes a vector to unit length (L2 norm = 1)
func NormalizeL2(v []float32) []float32 {
	var sum float64
	for _, x := range v {
		sum += float64(x) * float64(x)
	}
	norm := math.Sqrt(sum)
	if norm == 0 {
		return v
	}

	result := make([]float32, len(v))
	for i, x := range v {
		result[i] = float32(float64(x) / norm)
	}
	return result
}

// DotProduct calculates dot product of two vectors
// For L2-normalized vectors, dot product equals cosine similarity
func DotProduct(a, b []float32) float32 {
	if len(a) != len(b) {
		return 0
	}
	var sum float64
	for i := range a {
		sum += float64(a[i]) * float64(b[i])
	}
	return float32(sum)
}

// SerializeEmbedding converts []float32 to []byte for BLOB storage
func SerializeEmbedding(embedding []float32) []byte {
	buf := new(bytes.Buffer)
	for _, f := range embedding {
		_ = binary.Write(buf, binary.LittleEndian, f) // Error ignored: bytes.Buffer.Write never fails
	}
	return buf.Bytes()
}

// DeserializeEmbedding converts []byte back to []float32
func DeserializeEmbedding(data []byte) []float32 {
	if len(data) == 0 {
		return nil
	}
	count := len(data) / 4 // float32 = 4 bytes
	result := make([]float32, count)
	buf := bytes.NewReader(data)
	for i := 0; i < count; i++ {
		_ = binary.Read(buf, binary.LittleEndian, &result[i]) // Error ignored: reading from pre-sized buffer
	}
	return result
}

// ScoredScript holds a script with its similarity score
type ScoredScript struct {
	Script database.CrisisScriptDB
	Score  float32
}

// RetrieveRelevantScripts finds the most relevant scripts for a message
func (s *EmbeddingService) RetrieveRelevantScripts(
	message string,
	language string,
	crisisLevel int,
	topK int,
) ([]database.CrisisScriptDB, error) {
	if topK <= 0 {
		topK = DefaultTopK
	}

	// Generate embedding for user message
	msgEmbedding, err := s.GenerateEmbedding(message)
	if err != nil {
		return nil, fmt.Errorf("failed to generate message embedding: %w", err)
	}

	// Load all active scripts with embeddings
	var scripts []database.CrisisScriptDB
	if err := s.db.Where("is_active = ? AND embedding IS NOT NULL", true).Find(&scripts).Error; err != nil {
		return nil, fmt.Errorf("failed to load scripts: %w", err)
	}

	if len(scripts) == 0 {
		return nil, nil
	}

	// Calculate similarity scores
	var scored []ScoredScript
	for _, script := range scripts {
		scriptEmb := DeserializeEmbedding(script.Embedding)
		if scriptEmb == nil {
			continue
		}

		score := DotProduct(msgEmbedding, scriptEmb)

		// Filter by minimum similarity threshold
		if score < MinSimilarityScore {
			continue
		}

		scored = append(scored, ScoredScript{Script: script, Score: score})
	}

	// Sort by score descending
	for i := 0; i < len(scored)-1; i++ {
		for j := i + 1; j < len(scored); j++ {
			if scored[j].Score > scored[i].Score {
				scored[i], scored[j] = scored[j], scored[i]
			}
		}
	}

	// Return top K
	result := make([]database.CrisisScriptDB, 0, topK)
	for i := 0; i < topK && i < len(scored); i++ {
		result = append(result, scored[i].Script)
	}

	return result, nil
}

// HasEmbedding checks if a script has an embedding
func (s *EmbeddingService) HasEmbedding(scriptID uint) bool {
	var script database.CrisisScriptDB
	if err := s.db.Select("embedding").First(&script, scriptID).Error; err != nil {
		return false
	}
	return len(script.Embedding) > 0
}

// GetEmbeddingStats returns statistics about embeddings
func (s *EmbeddingService) GetEmbeddingStats() (total int64, withEmbedding int64, err error) {
	if err = s.db.Model(&database.CrisisScriptDB{}).Where("is_active = ?", true).Count(&total).Error; err != nil {
		return
	}
	if err = s.db.Model(&database.CrisisScriptDB{}).Where("is_active = ? AND embedding IS NOT NULL", true).Count(&withEmbedding).Error; err != nil {
		return
	}
	return
}

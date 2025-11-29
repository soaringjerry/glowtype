package services

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	// CacheExpiryHours defines how long cached analytics remain valid
	CacheExpiryHours = 1
)

// AnalyticsCacheService handles caching of analytics computations
type AnalyticsCacheService struct {
	db *gorm.DB
}

// NewAnalyticsCacheService creates a new cache service
func NewAnalyticsCacheService(db *gorm.DB) *AnalyticsCacheService {
	return &AnalyticsCacheService{db: db}
}

// BuildCacheKey generates a unique cache key for the given request
func (s *AnalyticsCacheService) BuildCacheKey(req AnalyticsRequest) string {
	tenantPart := "global"
	if req.TenantID != nil {
		tenantPart = fmt.Sprintf("tenant_%d", *req.TenantID)
	}

	if req.StartDate != "" && req.EndDate != "" {
		return fmt.Sprintf("analytics:custom:%s:%s:%s", req.StartDate, req.EndDate, tenantPart)
	}

	preset := req.Preset
	if preset == "" {
		preset = "30d"
	}
	return fmt.Sprintf("analytics:%s:%s", preset, tenantPart)
}

// GetCached attempts to retrieve cached analytics data
// Returns nil if cache is expired, stale, or doesn't exist
func (s *AnalyticsCacheService) GetCached(req AnalyticsRequest) (*database.AnalyticsCacheDB, error) {
	cacheKey := s.BuildCacheKey(req)

	var cache database.AnalyticsCacheDB
	err := s.db.Where("cache_key = ? AND expires_at > ? AND is_stale = ?",
		cacheKey, time.Now(), false).First(&cache).Error

	if err != nil {
		return nil, err
	}
	return &cache, nil
}

// SaveCache stores computed analytics in the cache
func (s *AnalyticsCacheService) SaveCache(req AnalyticsRequest, data *AnalyticsResponse, lastResultID uint) error {
	cacheKey := s.BuildCacheKey(req)

	// Serialize all data fields
	summaryJSON, err := json.Marshal(data.Summary)
	if err != nil {
		return fmt.Errorf("failed to marshal summary: %w", err)
	}

	dimensionJSON, err := json.Marshal(data.DimensionStats)
	if err != nil {
		return fmt.Errorf("failed to marshal dimension stats: %w", err)
	}

	reliabilityJSON, err := json.Marshal(data.Reliability)
	if err != nil {
		return fmt.Errorf("failed to marshal reliability: %w", err)
	}

	trendJSON, err := json.Marshal(data.Trends)
	if err != nil {
		return fmt.Errorf("failed to marshal trends: %w", err)
	}

	segmentJSON, err := json.Marshal(data.Segments)
	if err != nil {
		return fmt.Errorf("failed to marshal segments: %w", err)
	}

	correlationJSON, err := json.Marshal(data.CorrelationMatrix)
	if err != nil {
		return fmt.Errorf("failed to marshal correlation matrix: %w", err)
	}

	// Determine date range type
	dateRangeType := req.Preset
	if dateRangeType == "" {
		if req.StartDate != "" && req.EndDate != "" {
			dateRangeType = "custom"
		} else {
			dateRangeType = "30d"
		}
	}

	cache := database.AnalyticsCacheDB{
		CacheKey:          cacheKey,
		DateRangeType:     dateRangeType,
		StartDate:         data.Summary.DateRange.Start,
		EndDate:           data.Summary.DateRange.End,
		SummaryData:       summaryJSON,
		DimensionStats:    dimensionJSON,
		ReliabilityStats:  reliabilityJSON,
		TrendData:         trendJSON,
		SegmentData:       segmentJSON,
		CorrelationMatrix: correlationJSON,
		SampleCount:       data.Summary.TotalResponses,
		LastResultID:      lastResultID,
		ComputedAt:        time.Now(),
		ExpiresAt:         time.Now().Add(time.Hour * CacheExpiryHours),
		IsStale:           false,
	}

	if req.TenantID != nil {
		cache.TenantID = req.TenantID
	}

	// Upsert: insert or update on conflict
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "cache_key"}},
		UpdateAll: true,
	}).Create(&cache).Error
}

// MarkStale marks all caches for a tenant as stale (needs recomputation)
// Called when new quiz results are submitted
func (s *AnalyticsCacheService) MarkStale(tenantID *uint) error {
	query := s.db.Model(&database.AnalyticsCacheDB{})
	if tenantID != nil {
		query = query.Where("tenant_id = ?", *tenantID)
	} else {
		query = query.Where("tenant_id IS NULL")
	}
	return query.Update("is_stale", true).Error
}

// MarkAllStale marks all analytics caches as stale
func (s *AnalyticsCacheService) MarkAllStale() error {
	return s.db.Model(&database.AnalyticsCacheDB{}).
		Update("is_stale", true).Error
}

// CleanExpired removes expired cache entries
func (s *AnalyticsCacheService) CleanExpired() error {
	return s.db.Where("expires_at < ?", time.Now()).
		Delete(&database.AnalyticsCacheDB{}).Error
}

// UnmarshalCache deserializes cached data into AnalyticsResponse
func (s *AnalyticsCacheService) UnmarshalCache(cache *database.AnalyticsCacheDB) (*AnalyticsResponse, error) {
	var response AnalyticsResponse

	if err := json.Unmarshal(cache.SummaryData, &response.Summary); err != nil {
		return nil, fmt.Errorf("failed to unmarshal summary: %w", err)
	}

	if err := json.Unmarshal(cache.DimensionStats, &response.DimensionStats); err != nil {
		return nil, fmt.Errorf("failed to unmarshal dimension stats: %w", err)
	}

	if err := json.Unmarshal(cache.ReliabilityStats, &response.Reliability); err != nil {
		return nil, fmt.Errorf("failed to unmarshal reliability: %w", err)
	}

	if err := json.Unmarshal(cache.TrendData, &response.Trends); err != nil {
		return nil, fmt.Errorf("failed to unmarshal trends: %w", err)
	}

	if err := json.Unmarshal(cache.SegmentData, &response.Segments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal segments: %w", err)
	}

	if err := json.Unmarshal(cache.CorrelationMatrix, &response.CorrelationMatrix); err != nil {
		return nil, fmt.Errorf("failed to unmarshal correlation matrix: %w", err)
	}

	// Add constants (not cached, always fresh)
	response.Constants = AnalyticsConstants{
		MinReliabilitySample: minReliabilitySample,
		MinCorrelationSample: minCorrelationSample,
		MinValiditySample:    minValiditySample,
	}

	return &response, nil
}

// GetLastResultID gets the ID of the most recent quiz result for a tenant
func (s *AnalyticsCacheService) GetLastResultID(tenantID *uint) (uint, error) {
	var result database.QuizResultDB
	query := s.db.Model(&database.QuizResultDB{}).Order("id DESC").Limit(1)

	if tenantID != nil {
		query = query.Where("tenant_id = ? OR tenant_id IS NULL", *tenantID)
	} else {
		query = query.Where("tenant_id IS NULL")
	}

	err := query.First(&result).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return 0, nil
		}
		return 0, err
	}
	return result.ID, nil
}

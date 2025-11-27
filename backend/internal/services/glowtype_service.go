package services

import (
	"encoding/json"
	"strings"

	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/models"
	"gorm.io/gorm"
)

type GlowtypeService struct {
	db            *gorm.DB
	fallbackItems []models.GlowtypeConfig // Fallback to config file if DB is empty
}

func NewGlowtypeService(db *gorm.DB, fallbackItems []models.GlowtypeConfig) *GlowtypeService {
	return &GlowtypeService{
		db:            db,
		fallbackItems: fallbackItems,
	}
}

func (s *GlowtypeService) GetGlowtype(id, lang string) (*models.GlowtypeResponse, error) {
	lang = normalizeLangInternal(lang)

	// Try to fetch from database first
	var glowtype database.GlowtypeDB
	if err := s.db.Where("type_code = ? AND is_active = ?", id, true).First(&glowtype).Error; err == nil {
		// Found in database, get i18n
		var i18n database.GlowtypeI18NDB
		langQuery := lang
		if lang == "zh-CN" {
			langQuery = "zh"
		}

		// Try exact lang, then fallback to "en"
		if err := s.db.Where("glowtype_id = ? AND lang = ?", glowtype.ID, langQuery).First(&i18n).Error; err != nil {
			// Try English fallback
			s.db.Where("glowtype_id = ? AND lang = ?", glowtype.ID, "en").First(&i18n)
		}

		// Parse description and selfCareTips - support both JSON array and plain string
		var description []string
		var selfCareTips []string
		if i18n.Description != "" {
			// Try JSON array first, fallback to plain string
			if err := json.Unmarshal([]byte(i18n.Description), &description); err != nil {
				// Not JSON array, treat as plain string
				description = []string{i18n.Description}
			}
		}
		if i18n.SelfCareTips != "" {
			// Try JSON array first, fallback to plain string
			if err := json.Unmarshal([]byte(i18n.SelfCareTips), &selfCareTips); err != nil {
				// Not JSON array, treat as plain string
				selfCareTips = []string{i18n.SelfCareTips}
			}
		}

		return &models.GlowtypeResponse{
			ID:           glowtype.TypeCode,
			Language:     lang,
			Name:         i18n.Name,
			Tagline:      i18n.Tagline,
			Description:  description,
			SelfCareTips: selfCareTips,
			Disclaimer:   i18n.Disclaimer,
			// Include styling info
			AuraGradient: glowtype.AuraGradient,
			CardAccent:   glowtype.CardAccent,
			TextColor:    glowtype.TextColor,
		}, nil
	}

	// Fallback to config file
	for _, item := range s.fallbackItems {
		if item.ID != id {
			continue
		}

		loc, ok := item.Translations[lang]
		if !ok {
			loc = item.Translations["en"]
		}

		return &models.GlowtypeResponse{
			ID:           item.ID,
			Language:     lang,
			Name:         loc.Name,
			Tagline:      loc.Tagline,
			Description:  loc.Description,
			SelfCareTips: loc.SelfCareTips,
			Disclaimer:   loc.Disclaimer,
		}, nil
	}

	return nil, gorm.ErrRecordNotFound
}

func normalizeLangInternal(lang string) string {
	lang = strings.TrimSpace(lang)
	if lang == "" {
		return "en"
	}
	if strings.HasPrefix(lang, "zh") {
		return "zh-CN"
	}
	if strings.HasPrefix(lang, "en") {
		return "en"
	}
	return "en"
}

package services

import (
	"errors"
	"strings"

	"github.com/soaringjerry/glowtype/internal/models"
)

type GlowtypeService struct {
	items []models.GlowtypeConfig
}

func NewGlowtypeService(items []models.GlowtypeConfig) *GlowtypeService {
	return &GlowtypeService{items: items}
}

func (s *GlowtypeService) GetGlowtype(id, lang string) (*models.GlowtypeResponse, error) {
	lang = normalizeLangInternal(lang)

	for _, item := range s.items {
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

	return nil, errors.New("glowtype not found")
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

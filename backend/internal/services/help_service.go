package services

import "github.com/soaringjerry/glowtype/internal/models"

type HelpService struct{}

func NewHelpService() *HelpService {
	return &HelpService{}
}

func (s *HelpService) GetHelp(lang string) models.HelpResponse {
	if lang == "zh-CN" || lang == "zh" {
		return models.HelpResponse{
			Language:        "zh-CN",
			CrisisDisclaimer: "如果你觉得自己非常不安全或有立即的危险，请优先联系当地的紧急电话或可信任的大人：",
			Hotlines: []models.HotlineInfo{
				{
					Name:    "北京心理危机干预中心热线",
					Phone:   "800-810-1117 / 010-8295-1332",
					Website: "http://www.crisis.org.cn/",
					Note:    "24 小时心理危机干预热线",
				},
			},
		}
	}

	// default to English-style example
	return models.HelpResponse{
		Language:        "en",
		CrisisDisclaimer: "If you feel unsafe or in crisis, consider reaching out to:",
		Hotlines: []models.HotlineInfo{
			{
				Name:    "Samaritans of Singapore (SOS)",
				Phone:   "+65 1767",
				Website: "https://www.sos.org.sg/",
				Note:    "24/7 crisis hotline",
			},
		},
	}
}


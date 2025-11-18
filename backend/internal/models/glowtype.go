package models

type GlowtypeConfig struct {
	ID           string                            `json:"id"`
	Translations map[string]GlowtypeLocalized      `json:"translations"`
}

type GlowtypeLocalized struct {
	Name          string   `json:"name"`
	Tagline       string   `json:"tagline"`
	Description   []string `json:"description"`
	SelfCareTips  []string `json:"selfCareTips"`
	Disclaimer    string   `json:"disclaimer"`
}

type GlowtypeResponse struct {
	ID           string   `json:"id"`
	Language     string   `json:"language"`
	Name         string   `json:"name"`
	Tagline      string   `json:"tagline"`
	Description  []string `json:"description"`
	SelfCareTips []string `json:"selfCareTips"`
	Disclaimer   string   `json:"disclaimer"`
}


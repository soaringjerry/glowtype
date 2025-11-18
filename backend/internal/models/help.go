package models

type HelpResponse struct {
	Language        string        `json:"language"`
	CrisisDisclaimer string       `json:"crisisDisclaimer"`
	Hotlines        []HotlineInfo `json:"hotlines"`
}

type HotlineInfo struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Website string `json:"website"`
	Note    string `json:"note"`
}


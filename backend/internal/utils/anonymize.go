// Package utils provides utility functions for data anonymization
package utils

import (
	"net"
	"net/http"
	"strings"
	"time"
)

// AnonymizedRequestInfo contains anonymized info extracted from HTTP request
type AnonymizedRequestInfo struct {
	Region      string // Country/region code (e.g., "SG", "CN", "US")
	DeviceType  string // "mobile", "tablet", "desktop"
	BrowserLang string // Primary language from Accept-Language
	HourOfDay   int    // 0-23 in UTC
}

// ExtractAnonymizedInfo extracts anonymized info from HTTP request
// IP is used to derive region, then discarded
func ExtractAnonymizedInfo(r *http.Request) AnonymizedRequestInfo {
	info := AnonymizedRequestInfo{
		HourOfDay: time.Now().UTC().Hour(),
	}

	// Extract region from IP (then IP is discarded)
	info.Region = GetRegionFromIP(GetClientIP(r))

	// Parse User-Agent for device type
	info.DeviceType = ParseDeviceType(r.UserAgent())

	// Get browser language preference
	info.BrowserLang = ParseBrowserLang(r.Header.Get("Accept-Language"))

	return info
}

// GetClientIP extracts client IP from request, handling proxies
func GetClientIP(r *http.Request) string {
	// Check X-Forwarded-For (from reverse proxies like nginx, cloudflare)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP (original client)
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}

	// Check X-Real-IP
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Check CF-Connecting-IP (Cloudflare)
	cfip := r.Header.Get("CF-Connecting-IP")
	if cfip != "" {
		return cfip
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// GetRegionFromIP derives region code from IP address
// Uses a simple approach - for production, consider using MaxMind GeoIP or similar
// The IP is NOT stored, only the derived region
func GetRegionFromIP(ip string) string {
	// For now, return "unknown" - implement with GeoIP database if needed
	// TODO: Integrate with a GeoIP service (MaxMind, ip-api, etc.)
	//
	// Example implementation with ip-api (rate limited, for low volume):
	// resp, err := http.Get("http://ip-api.com/json/" + ip + "?fields=countryCode")
	// if err == nil { ... parse response ... }
	//
	// For production, use local MaxMind database:
	// db, _ := geoip2.Open("GeoLite2-Country.mmdb")
	// record, _ := db.Country(net.ParseIP(ip))
	// return record.Country.IsoCode

	if ip == "" || ip == "127.0.0.1" || ip == "::1" {
		return "local"
	}

	// Placeholder - always returns "unknown" until GeoIP is configured
	return "unknown"
}

// ParseDeviceType extracts device type from User-Agent
func ParseDeviceType(ua string) string {
	ua = strings.ToLower(ua)

	// Mobile patterns
	mobilePatterns := []string{
		"mobile", "android", "iphone", "ipod", "blackberry",
		"windows phone", "opera mini", "iemobile",
	}
	for _, pattern := range mobilePatterns {
		if strings.Contains(ua, pattern) {
			// Check if it's a tablet
			if strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad") {
				return "tablet"
			}
			return "mobile"
		}
	}

	// Tablet patterns
	tabletPatterns := []string{"ipad", "tablet", "kindle", "silk"}
	for _, pattern := range tabletPatterns {
		if strings.Contains(ua, pattern) {
			return "tablet"
		}
	}

	// Default to desktop
	if ua != "" {
		return "desktop"
	}
	return "unknown"
}

// ParseBrowserLang extracts primary language from Accept-Language header
func ParseBrowserLang(acceptLang string) string {
	if acceptLang == "" {
		return "unknown"
	}

	// Accept-Language format: "en-US,en;q=0.9,zh-CN;q=0.8"
	// Take the first language (highest priority)
	parts := strings.Split(acceptLang, ",")
	if len(parts) > 0 {
		lang := strings.TrimSpace(parts[0])
		// Remove quality value if present
		if idx := strings.Index(lang, ";"); idx > 0 {
			lang = lang[:idx]
		}
		// Normalize to lowercase
		return strings.ToLower(lang)
	}
	return "unknown"
}

// Crisis keyword detection for research flags
var crisisKeywords = []string{
	// English
	"suicide", "kill myself", "want to die", "end my life", "self harm",
	"hurt myself", "cutting", "overdose", "no reason to live",
	// Chinese
	"自杀", "想死", "不想活", "自残", "割腕", "结束生命", "活不下去",
}

// ContainsCrisisKeywords checks if text contains crisis-related keywords
// Used for research analytics only, not for real-time intervention
func ContainsCrisisKeywords(text string) bool {
	lower := strings.ToLower(text)
	for _, keyword := range crisisKeywords {
		if strings.Contains(lower, keyword) {
			return true
		}
	}
	return false
}

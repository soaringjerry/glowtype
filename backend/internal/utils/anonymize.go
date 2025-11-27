// Package utils provides utility functions for data anonymization
package utils

import (
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
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
	// First check Cloudflare header, then fall back to GeoIP lookup
	info.Region = GetRegionFromRequest(r)

	// Parse User-Agent for device type
	info.DeviceType = ParseDeviceType(r.UserAgent())

	// Get browser language preference
	info.BrowserLang = ParseBrowserLang(r.Header.Get("Accept-Language"))

	return info
}

// GetClientIP extracts client IP from request, handling proxies
func GetClientIP(r *http.Request) string {
	// Check CF-Connecting-IP (Cloudflare) first
	cfip := r.Header.Get("CF-Connecting-IP")
	if cfip != "" {
		return cfip
	}

	// Check X-Forwarded-For (from reverse proxies like nginx)
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

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// GetRegionFromRequest gets region, preferring Cloudflare header
func GetRegionFromRequest(r *http.Request) string {
	// Cloudflare provides country code in header (most reliable, no lookup needed)
	cfCountry := r.Header.Get("CF-IPCountry")
	if cfCountry != "" && cfCountry != "XX" {
		return strings.ToUpper(cfCountry)
	}

	// Fall back to GeoIP lookup
	ip := GetClientIP(r)
	return GetRegionFromIP(ip)
}

// GeoIP cache to avoid repeated lookups
var (
	geoCache     = make(map[string]string)
	geoCacheMu   sync.RWMutex
	geoCacheTime = make(map[string]time.Time)
	geoCacheTTL  = 24 * time.Hour
)

// GetRegionFromIP derives region code from IP address.
// External lookup is enabled by default (HTTPS); set DISABLE_GEOIP_LOOKUP=true to turn it off.
// The IP is NOT stored, only the derived region.
func GetRegionFromIP(ip string) string {
	if ip == "" || ip == "127.0.0.1" || ip == "::1" {
		return "local"
	}

	// Avoid external calls unless explicitly enabled.
	if !isGeoLookupEnabled() {
		return "unknown"
	}

	// Check if it's a private IP
	if isPrivateIP(ip) {
		return "private"
	}

	// Check cache
	geoCacheMu.RLock()
	if region, ok := geoCache[ip]; ok {
		if time.Since(geoCacheTime[ip]) < geoCacheTTL {
			geoCacheMu.RUnlock()
			return region
		}
	}
	geoCacheMu.RUnlock()

	// Query ip-api.com (free, no API key needed)
	region := lookupIPRegion(ip)

	// Cache result
	geoCacheMu.Lock()
	geoCache[ip] = region
	geoCacheTime[ip] = time.Now()
	// Clean old entries if cache gets too big
	if len(geoCache) > 10000 {
		cleanGeoCache()
	}
	geoCacheMu.Unlock()

	return region
}

// lookupIPRegion queries a HTTPS GeoIP endpoint for country code
func lookupIPRegion(ip string) string {
	client := &http.Client{Timeout: 2 * time.Second}
	escapedIP := url.PathEscape(ip)
	resp, err := client.Get("https://ipapi.co/" + escapedIP + "/country/")
	if err != nil {
		return "unknown"
	}
	defer resp.Body.Close()

	// ipapi.co returns the country code as plain text
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "unknown"
	}

	code := strings.TrimSpace(string(body))
	if len(code) == 2 {
		return strings.ToUpper(code)
	}
	return "unknown"
}

// cleanGeoCache removes entries older than TTL
func cleanGeoCache() {
	now := time.Now()
	for ip, t := range geoCacheTime {
		if now.Sub(t) > geoCacheTTL {
			delete(geoCache, ip)
			delete(geoCacheTime, ip)
		}
	}
}

// isPrivateIP checks if an IP is a private/internal address
func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	privateBlocks := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"fc00::/7",
	}

	for _, block := range privateBlocks {
		_, cidr, _ := net.ParseCIDR(block)
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}

func isGeoLookupEnabled() bool {
	disable := strings.ToLower(strings.TrimSpace(os.Getenv("DISABLE_GEOIP_LOOKUP")))
	if disable == "1" || disable == "true" || disable == "yes" {
		return false
	}

	if v := strings.ToLower(strings.TrimSpace(os.Getenv("ENABLE_GEOIP_LOOKUP"))); v != "" {
		return v == "1" || v == "true" || v == "yes"
	}

	return true
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

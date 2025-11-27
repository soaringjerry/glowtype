package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS(allowedOrigin string) gin.HandlerFunc {
	allowed := parseAllowedOrigins(allowedOrigin)
	allowAll := allowedOrigin == "*" || containsWildcard(allowed)

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		originAllowed := origin != "" && (allowAll || allowed[origin])

		if originAllowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
			// Only allow credentials for explicit origins, never with wildcard.
			if !allowAll {
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept-Language, Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func parseAllowedOrigins(raw string) map[string]bool {
	result := make(map[string]bool)
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result[trimmed] = true
		}
	}
	return result
}

func containsWildcard(origins map[string]bool) bool {
	_, ok := origins["*"]
	return ok
}

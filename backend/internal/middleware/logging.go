package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// PrivacyLogger logs minimal request information without full IP.
func PrivacyLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.Request.URL.Path

		log.Printf("%s %s -> %d (%s)", method, path, status, latency)
	}
}


package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/services"
)

// GetAnalyticsHandler returns comprehensive analytics data for research and trend analysis
// GET /api/admin/stats/analytics
// Query params:
//   - start_date: YYYY-MM-DD (optional)
//   - end_date: YYYY-MM-DD (optional)
//   - preset: "30d", "90d", "all" (optional, defaults to 30d)
//   - force: "true" to bypass cache and force recomputation
func GetAnalyticsHandler(c *gin.Context) {
	db := database.GetDB()
	analyticsService := services.NewAnalyticsService(db)

	req := services.AnalyticsRequest{
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		Preset:    c.DefaultQuery("preset", "30d"),
	}

	// Check for tenant context if needed
	if tenantID, exists := c.Get("tenantID"); exists {
		if tid, ok := tenantID.(uint); ok {
			req.TenantID = &tid
		}
	}

	// Check for force refresh flag
	forceRefresh := c.Query("force") == "true"

	var analytics *services.AnalyticsResponse
	var err error

	if forceRefresh {
		analytics, err = analyticsService.GetAnalyticsForceRefresh(req)
	} else {
		analytics, err = analyticsService.GetAnalytics(req)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate analytics"})
		return
	}

	c.JSON(http.StatusOK, analytics)
}

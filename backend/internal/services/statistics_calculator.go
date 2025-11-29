package services

import (
	"math"
	"sort"
)

// StatisticsCalculator provides advanced statistical calculations
type StatisticsCalculator struct{}

// NewStatisticsCalculator creates a new calculator
func NewStatisticsCalculator() *StatisticsCalculator {
	return &StatisticsCalculator{}
}

// AdvancedStats contains advanced statistical measures
type AdvancedStats struct {
	Skewness    float64     `json:"skewness"`
	Kurtosis    float64     `json:"kurtosis"`
	NormalityP  float64     `json:"normalityP"`  // p-value for normality test
	IsNormal    bool        `json:"isNormal"`    // p > 0.05
	Percentiles Percentiles `json:"percentiles"`
}

// Percentiles contains key percentile values
type Percentiles struct {
	P5  float64 `json:"p5"`
	P10 float64 `json:"p10"`
	P25 float64 `json:"p25"`
	P50 float64 `json:"p50"`
	P75 float64 `json:"p75"`
	P90 float64 `json:"p90"`
	P95 float64 `json:"p95"`
}

// TTestResult contains results from t-test
type TTestResult struct {
	Statistic     float64 `json:"statistic"`
	DegreesOfFree float64 `json:"degreesOfFreedom"`
	PValue        float64 `json:"pValue"`
	IsSignificant bool    `json:"isSignificant"` // p < 0.05
}

// ANOVAResult contains results from one-way ANOVA
type ANOVAResult struct {
	FStatistic    float64 `json:"fStatistic"`
	DfBetween     int     `json:"dfBetween"`
	DfWithin      int     `json:"dfWithin"`
	PValue        float64 `json:"pValue"`
	IsSignificant bool    `json:"isSignificant"`
}

// EffectSize contains effect size measures
type EffectSize struct {
	CohensD        float64 `json:"cohensD,omitempty"`
	EtaSquared     float64 `json:"etaSquared,omitempty"`
	Interpretation string  `json:"interpretation"` // negligible, small, medium, large
}

// CalculateAdvancedStats computes advanced statistics for a dataset
func (c *StatisticsCalculator) CalculateAdvancedStats(values []float64) AdvancedStats {
	if len(values) < 4 {
		return AdvancedStats{}
	}

	// Sort for percentile calculations
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	return AdvancedStats{
		Skewness:    c.CalculateSkewness(values),
		Kurtosis:    c.CalculateKurtosis(values),
		NormalityP:  c.TestNormality(values),
		IsNormal:    c.TestNormality(values) > 0.05,
		Percentiles: c.CalculatePercentiles(sorted),
	}
}

// CalculateSkewness computes Fisher's skewness coefficient
func (c *StatisticsCalculator) CalculateSkewness(values []float64) float64 {
	n := float64(len(values))
	if n < 3 {
		return 0
	}

	mean := c.mean(values)
	stdDev := c.stdDev(values, mean)
	if stdDev == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		sum += math.Pow((v-mean)/stdDev, 3)
	}

	// Fisher's adjustment for sample skewness
	return (n / ((n - 1) * (n - 2))) * sum
}

// CalculateKurtosis computes excess kurtosis (Fisher's definition)
func (c *StatisticsCalculator) CalculateKurtosis(values []float64) float64 {
	n := float64(len(values))
	if n < 4 {
		return 0
	}

	mean := c.mean(values)
	stdDev := c.stdDev(values, mean)
	if stdDev == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		sum += math.Pow((v-mean)/stdDev, 4)
	}

	// Fisher's adjustment for excess kurtosis
	k := ((n*(n+1))/((n-1)*(n-2)*(n-3)))*sum -
		(3*(n-1)*(n-1))/((n-2)*(n-3))

	return k
}

// TestNormality performs D'Agostino-Pearson omnibus test for normality
// Returns p-value (higher = more normal)
func (c *StatisticsCalculator) TestNormality(values []float64) float64 {
	n := float64(len(values))
	if n < 8 {
		return 1.0 // Not enough data for reliable test
	}

	skew := c.CalculateSkewness(values)
	kurt := c.CalculateKurtosis(values)

	// D'Agostino-Pearson K² statistic approximation
	// K² = Z_s² + Z_k² follows chi-squared with df=2

	// Transform skewness
	zsSquared := c.transformSkewnessToZ(skew, n) * c.transformSkewnessToZ(skew, n)

	// Transform kurtosis
	zkSquared := c.transformKurtosisToZ(kurt, n) * c.transformKurtosisToZ(kurt, n)

	k2 := zsSquared + zkSquared

	// Chi-squared p-value with df=2
	pValue := 1.0 - c.chiSquaredCDF(k2, 2)
	if pValue < 0 {
		pValue = 0
	}
	if pValue > 1 {
		pValue = 1
	}

	return pValue
}

// transformSkewnessToZ transforms skewness to approximate Z-score
func (c *StatisticsCalculator) transformSkewnessToZ(g1, n float64) float64 {
	if n < 8 {
		return 0
	}
	// Standard error of skewness approximation
	ses := math.Sqrt(6.0 * n * (n - 1) / ((n - 2) * (n + 1) * (n + 3)))
	return g1 / ses
}

// transformKurtosisToZ transforms kurtosis to approximate Z-score
func (c *StatisticsCalculator) transformKurtosisToZ(g2, n float64) float64 {
	if n < 8 {
		return 0
	}
	// Standard error of kurtosis approximation
	sek := 2 * math.Sqrt(6.0/n) * math.Sqrt((n*n-1)/((n-3)*(n+5)))
	if sek == 0 {
		return 0
	}
	return g2 / sek
}

// CalculatePercentiles computes key percentiles from sorted data
func (c *StatisticsCalculator) CalculatePercentiles(sorted []float64) Percentiles {
	return Percentiles{
		P5:  c.percentile(sorted, 5),
		P10: c.percentile(sorted, 10),
		P25: c.percentile(sorted, 25),
		P50: c.percentile(sorted, 50),
		P75: c.percentile(sorted, 75),
		P90: c.percentile(sorted, 90),
		P95: c.percentile(sorted, 95),
	}
}

// CohensD calculates Cohen's d effect size between two groups
func (c *StatisticsCalculator) CohensD(group1, group2 []float64) float64 {
	if len(group1) < 2 || len(group2) < 2 {
		return 0
	}

	mean1 := c.mean(group1)
	mean2 := c.mean(group2)

	n1 := float64(len(group1))
	n2 := float64(len(group2))

	var1 := c.variance(group1, mean1)
	var2 := c.variance(group2, mean2)

	// Pooled standard deviation
	pooledSD := math.Sqrt(((n1-1)*var1 + (n2-1)*var2) / (n1 + n2 - 2))

	if pooledSD == 0 {
		return 0
	}

	return (mean1 - mean2) / pooledSD
}

// InterpretCohensD provides interpretation of Cohen's d
func (c *StatisticsCalculator) InterpretCohensD(d float64) string {
	absD := math.Abs(d)
	if absD < 0.2 {
		return "negligible"
	} else if absD < 0.5 {
		return "small"
	} else if absD < 0.8 {
		return "medium"
	}
	return "large"
}

// TTest performs Welch's t-test for independent samples
func (c *StatisticsCalculator) TTest(group1, group2 []float64) TTestResult {
	n1 := float64(len(group1))
	n2 := float64(len(group2))

	if n1 < 2 || n2 < 2 {
		return TTestResult{PValue: 1.0}
	}

	mean1 := c.mean(group1)
	mean2 := c.mean(group2)
	var1 := c.variance(group1, mean1)
	var2 := c.variance(group2, mean2)

	se := math.Sqrt(var1/n1 + var2/n2)
	if se == 0 {
		return TTestResult{PValue: 1.0}
	}

	t := (mean1 - mean2) / se

	// Welch-Satterthwaite degrees of freedom
	num := math.Pow(var1/n1+var2/n2, 2)
	denom := math.Pow(var1/n1, 2)/(n1-1) + math.Pow(var2/n2, 2)/(n2-1)
	df := num / denom

	// Two-tailed p-value
	pValue := 2 * c.tDistributionPValue(math.Abs(t), df)

	return TTestResult{
		Statistic:     round3(t),
		DegreesOfFree: round3(df),
		PValue:        round3(pValue),
		IsSignificant: pValue < 0.05,
	}
}

// OneWayANOVA performs one-way ANOVA for multiple groups
func (c *StatisticsCalculator) OneWayANOVA(groups [][]float64) ANOVAResult {
	k := len(groups) // number of groups
	if k < 2 {
		return ANOVAResult{PValue: 1.0}
	}

	// Check minimum samples
	totalN := 0
	for _, g := range groups {
		if len(g) < 1 {
			return ANOVAResult{PValue: 1.0}
		}
		totalN += len(g)
	}

	if totalN <= k {
		return ANOVAResult{PValue: 1.0}
	}

	// Calculate grand mean
	grandSum := 0.0
	for _, g := range groups {
		for _, v := range g {
			grandSum += v
		}
	}
	grandMean := grandSum / float64(totalN)

	// Between-group sum of squares (SSB)
	ssb := 0.0
	for _, g := range groups {
		gMean := c.mean(g)
		ssb += float64(len(g)) * math.Pow(gMean-grandMean, 2)
	}

	// Within-group sum of squares (SSW)
	ssw := 0.0
	for _, g := range groups {
		gMean := c.mean(g)
		for _, v := range g {
			ssw += math.Pow(v-gMean, 2)
		}
	}

	dfBetween := k - 1
	dfWithin := totalN - k

	if dfWithin <= 0 || ssw == 0 {
		return ANOVAResult{PValue: 1.0}
	}

	msb := ssb / float64(dfBetween)
	msw := ssw / float64(dfWithin)

	f := msb / msw

	// F-distribution p-value
	pValue := 1.0 - c.fDistributionCDF(f, dfBetween, dfWithin)

	return ANOVAResult{
		FStatistic:    round3(f),
		DfBetween:     dfBetween,
		DfWithin:      dfWithin,
		PValue:        round3(pValue),
		IsSignificant: pValue < 0.05,
	}
}

// EtaSquared calculates eta-squared effect size from ANOVA
func (c *StatisticsCalculator) EtaSquared(groups [][]float64) float64 {
	if len(groups) < 2 {
		return 0
	}

	// Calculate grand mean
	totalN := 0
	grandSum := 0.0
	for _, g := range groups {
		totalN += len(g)
		for _, v := range g {
			grandSum += v
		}
	}
	grandMean := grandSum / float64(totalN)

	// Between-group sum of squares (SSB)
	ssb := 0.0
	for _, g := range groups {
		gMean := c.mean(g)
		ssb += float64(len(g)) * math.Pow(gMean-grandMean, 2)
	}

	// Total sum of squares (SST)
	sst := 0.0
	for _, g := range groups {
		for _, v := range g {
			sst += math.Pow(v-grandMean, 2)
		}
	}

	if sst == 0 {
		return 0
	}

	return ssb / sst
}

// InterpretEtaSquared provides interpretation of eta-squared
func (c *StatisticsCalculator) InterpretEtaSquared(eta2 float64) string {
	if eta2 < 0.01 {
		return "negligible"
	} else if eta2 < 0.06 {
		return "small"
	} else if eta2 < 0.14 {
		return "medium"
	}
	return "large"
}

// Helper functions

func (c *StatisticsCalculator) mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func (c *StatisticsCalculator) variance(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += (v - mean) * (v - mean)
	}
	return sum / float64(len(values)-1)
}

func (c *StatisticsCalculator) stdDev(values []float64, mean float64) float64 {
	return math.Sqrt(c.variance(values, mean))
}

func (c *StatisticsCalculator) percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}

	rank := (p / 100.0) * float64(len(sorted)-1)
	lower := int(math.Floor(rank))
	upper := int(math.Ceil(rank))
	if lower == upper {
		return sorted[lower]
	}
	frac := rank - float64(lower)
	return sorted[lower] + frac*(sorted[upper]-sorted[lower])
}

// t-distribution p-value approximation using normal approximation for large df
func (c *StatisticsCalculator) tDistributionPValue(t, df float64) float64 {
	if df <= 0 {
		return 1.0
	}
	// For df > 30, t-distribution approximates normal
	if df > 30 {
		return c.normalCDF(-math.Abs(t))
	}

	// Use a simple approximation for smaller df
	x := df / (df + t*t)
	return 0.5 * c.incompleteBeta(df/2, 0.5, x)
}

// Chi-squared CDF approximation
func (c *StatisticsCalculator) chiSquaredCDF(x float64, df int) float64 {
	if x <= 0 {
		return 0
	}
	return c.gammaCDF(x/2, float64(df)/2)
}

// F-distribution CDF approximation
func (c *StatisticsCalculator) fDistributionCDF(f float64, df1, df2 int) float64 {
	if f <= 0 {
		return 0
	}
	x := float64(df1) * f / (float64(df1)*f + float64(df2))
	return c.incompleteBeta(float64(df1)/2, float64(df2)/2, x)
}

// Normal CDF approximation (Abramowitz and Stegun)
func (c *StatisticsCalculator) normalCDF(x float64) float64 {
	a1 := 0.254829592
	a2 := -0.284496736
	a3 := 1.421413741
	a4 := -1.453152027
	a5 := 1.061405429
	p := 0.3275911

	sign := 1.0
	if x < 0 {
		sign = -1.0
	}
	x = math.Abs(x) / math.Sqrt(2)

	t := 1.0 / (1.0 + p*x)
	y := 1.0 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*math.Exp(-x*x)

	return 0.5 * (1.0 + sign*y)
}

// Gamma CDF approximation using series expansion
func (c *StatisticsCalculator) gammaCDF(x, a float64) float64 {
	if x <= 0 {
		return 0
	}
	if a <= 0 {
		return 0
	}

	// Use regularized incomplete gamma function
	return c.gammainc(a, x)
}

// Regularized incomplete gamma function (series expansion)
func (c *StatisticsCalculator) gammainc(a, x float64) float64 {
	if x < 0 {
		return 0
	}
	if a <= 0 {
		return 0
	}

	sum := 1.0 / a
	term := 1.0 / a
	for n := 1; n < 100; n++ {
		term *= x / (a + float64(n))
		sum += term
		if math.Abs(term) < 1e-10*math.Abs(sum) {
			break
		}
	}

	return sum * math.Exp(-x+a*math.Log(x)-c.logGamma(a))
}

// Incomplete beta function approximation
func (c *StatisticsCalculator) incompleteBeta(a, b, x float64) float64 {
	if x <= 0 {
		return 0
	}
	if x >= 1 {
		return 1
	}

	// Use continued fraction approximation
	bt := math.Exp(c.logGamma(a+b) - c.logGamma(a) - c.logGamma(b) +
		a*math.Log(x) + b*math.Log(1-x))

	if x < (a+1)/(a+b+2) {
		return bt * c.betacf(a, b, x) / a
	}
	return 1 - bt*c.betacf(b, a, 1-x)/b
}

// Beta continued fraction
func (c *StatisticsCalculator) betacf(a, b, x float64) float64 {
	qab := a + b
	qap := a + 1
	qam := a - 1
	c_ := 1.0
	d := 1 - qab*x/qap
	if math.Abs(d) < 1e-30 {
		d = 1e-30
	}
	d = 1 / d
	h := d

	for m := 1; m <= 100; m++ {
		m2 := 2 * m
		aa := float64(m) * (b - float64(m)) * x / ((qam + float64(m2)) * (a + float64(m2)))
		d = 1 + aa*d
		if math.Abs(d) < 1e-30 {
			d = 1e-30
		}
		c_ = 1 + aa/c_
		if math.Abs(c_) < 1e-30 {
			c_ = 1e-30
		}
		d = 1 / d
		h *= d * c_

		aa = -(a + float64(m)) * (qab + float64(m)) * x / ((a + float64(m2)) * (qap + float64(m2)))
		d = 1 + aa*d
		if math.Abs(d) < 1e-30 {
			d = 1e-30
		}
		c_ = 1 + aa/c_
		if math.Abs(c_) < 1e-30 {
			c_ = 1e-30
		}
		d = 1 / d
		delta := d * c_
		h *= delta

		if math.Abs(delta-1) < 3e-7 {
			break
		}
	}

	return h
}

// Log gamma function (Stirling's approximation)
func (c *StatisticsCalculator) logGamma(x float64) float64 {
	if x <= 0 {
		return 0
	}

	// Use Lanczos approximation
	g := 7.0
	coef := []float64{
		0.99999999999980993,
		676.5203681218851,
		-1259.1392167224028,
		771.32342877765313,
		-176.61502916214059,
		12.507343278686905,
		-0.13857109526572012,
		9.9843695780195716e-6,
		1.5056327351493116e-7,
	}

	if x < 0.5 {
		return math.Log(math.Pi/math.Sin(math.Pi*x)) - c.logGamma(1-x)
	}

	x -= 1
	a := coef[0]
	t := x + g + 0.5
	for i := 1; i < len(coef); i++ {
		a += coef[i] / (x + float64(i))
	}

	return 0.5*math.Log(2*math.Pi) + (x+0.5)*math.Log(t) - t + math.Log(a)
}

// round3 is defined in analytics_service.go

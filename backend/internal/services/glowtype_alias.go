package services

import "strings"

// CanonicalizeGlowtype maps legacy/alias type codes to the current canonical codes.
// This keeps analytics and display consistent between frontend and backend.
func CanonicalizeGlowtype(code string) string {
	switch strings.ToLower(code) {
	case "hidden-aurora":
		return "quiet-comet"
	case "warm-ember":
		return "radiant-nebula"
	default:
		return code
	}
}

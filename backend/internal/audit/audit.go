// Package audit provides enhanced audit logging with before/after diff,
// risk level classification, and integrity hash verification.
package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// DiffEntry represents a single field change
type DiffEntry struct {
	Before any `json:"before,omitempty"`
	After  any `json:"after,omitempty"`
}

// ResourceDiff holds the diff information for a resource
type ResourceDiff struct {
	ResourceType string               `json:"resourceType,omitempty"`
	ResourceID   uint                 `json:"resourceId,omitempty"`
	Fields       map[string]DiffEntry `json:"fields,omitempty"`
}

// Context keys for storing audit state
const (
	KeyBeforeState  = "audit_before_state"
	KeyAfterState   = "audit_after_state"
	KeyResourceType = "audit_resource_type"
	KeyResourceID   = "audit_resource_id"
)

// Sensitive field names that should be redacted in diffs
var sensitiveFields = map[string]bool{
	"password":        true,
	"passwordhash":    true,
	"pass":            true,
	"pwd":             true,
	"token":           true,
	"secret":          true,
	"apikey":          true,
	"api_key":         true,
	"twofactorsecret": true,
	"recoverycode":    true,
	"authorization":   true,
	"credential":      true,
	"openai":          true,
}

// SetBeforeState records the state before a mutation
func SetBeforeState(c *gin.Context, resourceType string, resourceID uint, state any) {
	c.Set(KeyResourceType, resourceType)
	c.Set(KeyResourceID, resourceID)
	c.Set(KeyBeforeState, state)
}

// SetAfterState records the state after a mutation
func SetAfterState(c *gin.Context, state any) {
	c.Set(KeyAfterState, state)
}

// SetCreateState records the state for a create operation (no before state)
func SetCreateState(c *gin.Context, resourceType string, resourceID uint, state any) {
	c.Set(KeyResourceType, resourceType)
	c.Set(KeyResourceID, resourceID)
	c.Set(KeyAfterState, state)
}

// SetDeleteState records the state for a delete operation (no after state)
func SetDeleteState(c *gin.Context, resourceType string, resourceID uint, state any) {
	c.Set(KeyResourceType, resourceType)
	c.Set(KeyResourceID, resourceID)
	c.Set(KeyBeforeState, state)
}

// ExtractDiff extracts diff information from the Gin context
func ExtractDiff(c *gin.Context) *ResourceDiff {
	resourceType, _ := c.Get(KeyResourceType)
	resourceID, _ := c.Get(KeyResourceID)
	beforeState, beforeExists := c.Get(KeyBeforeState)
	afterState, afterExists := c.Get(KeyAfterState)

	if !beforeExists && !afterExists {
		return nil
	}

	diff := &ResourceDiff{}

	if rt, ok := resourceType.(string); ok {
		diff.ResourceType = rt
	}
	if rid, ok := resourceID.(uint); ok {
		diff.ResourceID = rid
	}

	diff.Fields = ComputeDiff(beforeState, afterState)

	return diff
}

// ComputeDiff computes field-level differences between two states
func ComputeDiff(before, after any) map[string]DiffEntry {
	beforeMap := structToMap(before)
	afterMap := structToMap(after)

	diff := make(map[string]DiffEntry)

	// Collect all keys
	allKeys := make(map[string]struct{})
	for k := range beforeMap {
		allKeys[k] = struct{}{}
	}
	for k := range afterMap {
		allKeys[k] = struct{}{}
	}

	// Compare each field
	for key := range allKeys {
		// Skip sensitive fields
		if isSensitiveField(key) {
			continue
		}

		beforeVal, beforeExists := beforeMap[key]
		afterVal, afterExists := afterMap[key]

		// Detect changes
		if !beforeExists && afterExists {
			// New field (create)
			diff[key] = DiffEntry{After: afterVal}
		} else if beforeExists && !afterExists {
			// Removed field (delete)
			diff[key] = DiffEntry{Before: beforeVal}
		} else if !deepEqual(beforeVal, afterVal) {
			// Modified field
			diff[key] = DiffEntry{Before: beforeVal, After: afterVal}
		}
	}

	return diff
}

// structToMap converts a struct to a map[string]any
func structToMap(v any) map[string]any {
	if v == nil {
		return nil
	}

	// If already a map, return as-is
	if m, ok := v.(map[string]any); ok {
		return m
	}

	result := make(map[string]any)

	val := reflect.ValueOf(v)
	if val.Kind() == reflect.Ptr {
		if val.IsNil() {
			return nil
		}
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		// Try JSON marshaling for non-struct types
		data, err := json.Marshal(v)
		if err != nil {
			return nil
		}
		if err := json.Unmarshal(data, &result); err != nil {
			return nil
		}
		return result
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)

		// Skip unexported fields
		if !field.IsExported() {
			continue
		}

		// Get JSON tag name, fallback to field name
		name := field.Name
		if jsonTag := field.Tag.Get("json"); jsonTag != "" {
			parts := strings.Split(jsonTag, ",")
			if parts[0] != "" && parts[0] != "-" {
				name = parts[0]
			} else if parts[0] == "-" {
				continue // Skip fields with json:"-"
			}
		}

		fieldVal := val.Field(i)

		// Handle pointer types
		if fieldVal.Kind() == reflect.Ptr {
			if fieldVal.IsNil() {
				result[name] = nil
			} else {
				result[name] = fieldVal.Elem().Interface()
			}
		} else {
			result[name] = fieldVal.Interface()
		}
	}

	return result
}

// deepEqual compares two values for equality
func deepEqual(a, b any) bool {
	// Handle nil cases
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Use JSON serialization for complex types
	aJSON, err1 := json.Marshal(a)
	bJSON, err2 := json.Marshal(b)

	if err1 != nil || err2 != nil {
		return reflect.DeepEqual(a, b)
	}

	return string(aJSON) == string(bJSON)
}

// isSensitiveField checks if a field name is sensitive
func isSensitiveField(name string) bool {
	lower := strings.ToLower(name)
	if sensitiveFields[lower] {
		return true
	}

	// Check for partial matches
	for keyword := range sensitiveFields {
		if strings.Contains(lower, keyword) {
			return true
		}
	}

	return false
}

// HashInput represents the data used for integrity hash calculation
type HashInput struct {
	AdminID    uint
	Username   string
	Action     string
	Method     string
	Path       string
	StatusCode int
	Metadata   string
	DataDiff   string
	RiskLevel  string
	CreatedAt  string
}

// GenerateIntegrityHash generates a SHA256 hash for audit log integrity
func GenerateIntegrityHash(input HashInput) string {
	data := fmt.Sprintf(
		"%d|%s|%s|%s|%s|%d|%s|%s|%s|%s",
		input.AdminID,
		input.Username,
		input.Action,
		input.Method,
		input.Path,
		input.StatusCode,
		input.Metadata,
		input.DataDiff,
		input.RiskLevel,
		input.CreatedAt,
	)

	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// VerifyIntegrity verifies the integrity of an audit log entry
func VerifyIntegrity(input HashInput, expectedHash string) bool {
	computed := GenerateIntegrityHash(input)
	return computed == expectedHash
}

// FormatCreatedAt formats a time for hash input (UTC, RFC3339Nano)
func FormatCreatedAt(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

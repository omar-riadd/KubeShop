package platform

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Standard API error codes from Shared Contract §1.8.
const (
	CodeValidationError     = "VALIDATION_ERROR"
	CodeMissingSession      = "MISSING_SESSION"
	CodeProductNotFound     = "PRODUCT_NOT_FOUND"
	CodeOrderNotFound       = "ORDER_NOT_FOUND"
	CodeNotFound            = "NOT_FOUND"
	CodeMethodNotAllowed    = "METHOD_NOT_ALLOWED"
	CodeCartEmpty           = "CART_EMPTY"
	CodeInvalidTransition   = "INVALID_TRANSITION"
	CodeUnauthorized        = "UNAUTHORIZED"
	CodeRateLimitExceeded   = "RATE_LIMIT_EXCEEDED"
	CodeInternalError       = "INTERNAL_ERROR"
	CodeFaultInjected       = "FAULT_INJECTED"
	CodeUpstreamUnavailable = "UPSTREAM_UNAVAILABLE"
	CodeUpstreamTimeout     = "UPSTREAM_TIMEOUT"
)

// ErrorDetail represents a single field-level validation error.
type ErrorDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ErrorBody matches the Shared Contract §1.8 error payload.
type ErrorBody struct {
	Code      string        `json:"code"`
	Message   string        `json:"message"`
	RequestID string        `json:"requestId"`
	Details   []ErrorDetail `json:"details,omitempty"`
}

// ErrorEnvelope wraps ErrorBody under the "error" key.
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

// WriteJSON writes a JSON response with status code and standard headers.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// WriteError writes a Shared Contract §1.8 error response including requestId.
func WriteError(w http.ResponseWriter, r *http.Request, status int, code, message string, details ...ErrorDetail) {
	env := ErrorEnvelope{
		Error: ErrorBody{
			Code:      code,
			Message:   message,
			RequestID: RequestIDFromContext(r.Context()),
			Details:   details,
		},
	}
	WriteJSON(w, status, env)
}

// DecodeJSON decodes a JSON request body strictly (rejecting unknown fields and trailing data).
func DecodeJSON(r *http.Request, dst any) []ErrorDetail {
	if r.Body == nil {
		return []ErrorDetail{{Field: "body", Message: "request body is required"}}
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		return mapDecodeError(err)
	}
	// Ensure no trailing garbage after the first JSON value.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return []ErrorDetail{{Field: "body", Message: "request body must contain a single JSON object"}}
	}
	return nil
}

func mapDecodeError(err error) []ErrorDetail {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		return []ErrorDetail{{Field: "body", Message: "request body exceeds 16 KiB limit"}}
	}
	var syntaxErr *json.SyntaxError
	if errors.As(err, &syntaxErr) {
		return []ErrorDetail{{Field: "body", Message: "malformed JSON"}}
	}
	var unmarshalTypeErr *json.UnmarshalTypeError
	if errors.As(err, &unmarshalTypeErr) {
		field := unmarshalTypeErr.Field
		if field == "" {
			field = "body"
		}
		return []ErrorDetail{{Field: field, Message: fmt.Sprintf("invalid value type for %s", field)}}
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return []ErrorDetail{{Field: "body", Message: "request body is empty or incomplete"}}
	}
	msg := err.Error()
	if strings.HasPrefix(msg, "json: unknown field ") {
		field := strings.Trim(strings.TrimPrefix(msg, "json: unknown field "), `"`)
		return []ErrorDetail{{Field: field, Message: "unknown field"}}
	}
	return []ErrorDetail{{Field: "body", Message: "invalid JSON payload"}}
}

// NotFoundHandler returns a 404 NOT_FOUND JSON response.
func NotFoundHandler(w http.ResponseWriter, r *http.Request) {
	WriteError(w, r, http.StatusNotFound, CodeNotFound, "Route not found")
}

// MethodNotAllowedHandler returns a 405 METHOD_NOT_ALLOWED JSON response.
func MethodNotAllowedHandler(w http.ResponseWriter, r *http.Request) {
	WriteError(w, r, http.StatusMethodNotAllowed, CodeMethodNotAllowed, "Method not allowed")
}

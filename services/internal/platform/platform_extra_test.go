package platform_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

// TestParsePortEdgeCases covers the branches missed in parsePort (42.9% → higher).
func TestParsePortEdgeCases(t *testing.T) {
	// Valid non-default port
	t.Setenv("HTTP_PORT", "3000")
	cfg, err := platform.LoadConfig("svc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HTTPPort != 3000 {
		t.Fatalf("expected 3000, got %d", cfg.HTTPPort)
	}

	// Port = 0 → invalid
	t.Setenv("HTTP_PORT", "0")
	t.Setenv("APP_ENV", "local")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for port 0")
	}

	// Port > 65535 → invalid
	t.Setenv("HTTP_PORT", "99999")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for port 99999")
	}

	// Non-numeric port → invalid
	t.Setenv("HTTP_PORT", "abc")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for non-numeric port")
	}

	// FAULT_LATENCY_MS invalid
	t.Setenv("HTTP_PORT", "")
	t.Setenv("FAULT_LATENCY_MS", "bad")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for invalid FAULT_LATENCY_MS")
	}

	// FAULT_LATENCY_MS negative
	t.Setenv("FAULT_LATENCY_MS", "-1")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for negative FAULT_LATENCY_MS")
	}
	t.Setenv("FAULT_LATENCY_MS", "")

	// SHUTDOWN_DELAY invalid
	t.Setenv("SHUTDOWN_DELAY", "not-a-duration")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for invalid SHUTDOWN_DELAY")
	}
	t.Setenv("SHUTDOWN_DELAY", "")

	// SHUTDOWN_DELAY negative
	t.Setenv("SHUTDOWN_DELAY", "-1s")
	if _, err := platform.LoadConfig("svc"); err == nil {
		t.Fatal("expected error for negative SHUTDOWN_DELAY")
	}
	t.Setenv("SHUTDOWN_DELAY", "")

	// Valid staging env
	t.Setenv("APP_ENV", "staging")
	if _, err := platform.LoadConfig("svc"); err != nil {
		t.Fatalf("staging env should be valid, got %v", err)
	}

	// Valid prod env
	t.Setenv("APP_ENV", "prod")
	if _, err := platform.LoadConfig("svc"); err != nil {
		t.Fatalf("prod env should be valid, got %v", err)
	}
	t.Setenv("APP_ENV", "")
}

// TestDecodeJSONErrorBranches exercises mapDecodeError branches (57.9% → higher).
func TestDecodeJSONErrorBranches(t *testing.T) {
	cfg := platform.Config{ServiceName: "svc", AppEnv: "local"}
	logger := platform.NewLogger(cfg, io.Discard)
	r := platform.NewRouter(cfg, logger, nil)

	type body struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}
	r.With(platform.RequireSession).Post("/test", func(w http.ResponseWriter, req *http.Request) {
		var b body
		if details := platform.DecodeJSON(req, &b); len(details) > 0 {
			platform.WriteError(w, req, http.StatusBadRequest, platform.CodeValidationError, "bad", details...)
			return
		}
		platform.WriteJSON(w, http.StatusOK, b)
	})

	sessionID := "00000000-0000-4000-8000-000000000001"

	// Syntactically invalid JSON → syntax error branch
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader("{invalid"))
	req.Header.Set("X-Session-ID", sessionID)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad JSON, got %d", rec.Code)
	}

	// Wrong type → type mismatch branch
	req2 := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{"age":"not-a-number"}`))
	req2.Header.Set("X-Session-ID", sessionID)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for type mismatch, got %d", rec2.Code)
	}

	// Empty body → EOF branch
	req3 := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(""))
	req3.Header.Set("X-Session-ID", sessionID)
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty body, got %d", rec3.Code)
	}

	// Body too large → 400 with "request body exceeds 16 KiB limit" detail
	big := strings.Repeat("x", 17*1024)
	req4 := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{"name":"`+big+`"}`))
	req4.Header.Set("X-Session-ID", sessionID)
	rec4 := httptest.NewRecorder()
	r.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusBadRequest || !strings.Contains(rec4.Body.String(), "exceeds 16 KiB limit") {
		t.Fatalf("expected 400 with max bytes detail, got %d body=%s", rec4.Code, rec4.Body.String())
	}

	// Trailing garbage after first JSON object → single JSON object error
	req5 := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{"name":"ok"}{"extra":1}`))
	req5.Header.Set("X-Session-ID", sessionID)
	rec5 := httptest.NewRecorder()
	r.ServeHTTP(rec5, req5)
	if rec5.Code != http.StatusBadRequest || !strings.Contains(rec5.Body.String(), "single JSON object") {
		t.Fatalf("expected 400 for trailing JSON, got %d body=%s", rec5.Code, rec5.Body.String())
	}

	// Nil body directly to DecodeJSON
	reqNil, _ := http.NewRequest(http.MethodPost, "/test", nil)
	if details := platform.DecodeJSON(reqNil, &body{}); len(details) == 0 {
		t.Fatal("expected error details for nil body")
	}
}

// TestIsUUIDv4Branches covers IsUUIDv4 path where UUID parses but version != 4.
func TestIsUUIDv4Branches(t *testing.T) {
	// UUID v1 — parses fine but version != 4
	uuidV1 := "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
	if platform.IsUUIDv4(uuidV1) {
		t.Fatalf("IsUUIDv4 should return false for v1 UUID")
	}

	// Valid v4
	uuidV4 := "00000000-0000-4000-8000-000000000001"
	if !platform.IsUUIDv4(uuidV4) {
		t.Fatalf("IsUUIDv4 should return true for v4 UUID")
	}

	// Entirely invalid
	if platform.IsUUIDv4("not-a-uuid") {
		t.Fatalf("IsUUIDv4 should return false for garbage")
	}
}

// TestRecoverMiddlewareBody tests that the RecoverMiddleware recovers a panic and
// returns 500 (exercising the body-write path inside the recover handler).
func TestRecoverMiddlewareBody(t *testing.T) {
	cfg := platform.Config{ServiceName: "svc", AppEnv: "local"}
	var logBuf bytes.Buffer
	logger := platform.NewLogger(cfg, &logBuf)
	r := platform.NewRouter(cfg, logger, nil)

	r.Get("/panic", func(_ http.ResponseWriter, _ *http.Request) {
		panic("test panic")
	})

	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 from panic recovery, got %d", rec.Code)
	}
}

// TestNewHTTPClientIsNotNil exercises platform.NewHTTPClient (0% → covered).
func TestNewHTTPClientIsNotNil(t *testing.T) {
	// InitTracing with no OTLP endpoint → noop exporter (already tested elsewhere).
	// NewHTTPClient wraps the OTel transport and panics only if tracing is broken.
	cfg := platform.Config{ServiceName: "svc", AppEnv: "local"}
	shutdown, err := platform.InitTracing(context.Background(), cfg)
	if err != nil {
		t.Fatalf("InitTracing: %v", err)
	}
	defer func() { _ = shutdown(context.Background()) }()

	client := platform.NewHTTPClient(5 * time.Second)
	if client == nil {
		t.Fatal("expected non-nil *http.Client from NewHTTPClient")
	}
}

// TestRequestIDFromContextMissingKey tests RequestIDFromContext when ctx has no value.
func TestRequestIDFromContextMissingKey(t *testing.T) {
	if id := platform.RequestIDFromContext(context.Background()); id != "" {
		t.Fatalf("expected empty string, got %q", id)
	}
}

// TestSessionIDFromContextMissingKey tests SessionIDFromContext when ctx has no value.
func TestSessionIDFromContextMissingKey(t *testing.T) {
	if id := platform.SessionIDFromContext(context.Background()); id != "" {
		t.Fatalf("expected empty string, got %q", id)
	}
}

// TestFaultInjectionLatencyContextCancel covers the ctx.Done() case in FaultInjectionMiddleware.
func TestFaultInjectionLatencyContextCancel(t *testing.T) {
	cfg := platform.Config{
		ServiceName:    "svc",
		AppEnv:         "local",
		FaultLatencyMs: 500, // long enough to reliably cancel
	}
	logger := platform.NewLogger(cfg, io.Discard)
	r := platform.NewRouter(cfg, logger, nil)
	r.Get("/api/svc/slow", func(w http.ResponseWriter, _ *http.Request) {
		platform.WriteJSON(w, http.StatusOK, map[string]string{"ok": "true"})
	})

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/api/svc/slow", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	// Should return before writing a response body (context cancelled).
	r.ServeHTTP(rec, req)
	// No assertion on status code — just verify it doesn't hang.
}

// TestNewLoggerDebugLevel exercises the debug-level branch in NewLogger.
func TestNewLoggerDebugLevel(t *testing.T) {
	cfg := platform.Config{ServiceName: "svc", AppEnv: "local", LogLevel: "debug"}
	logger := platform.NewLogger(cfg, io.Discard)
	if logger == nil {
		t.Fatal("expected non-nil logger for debug level")
	}
}

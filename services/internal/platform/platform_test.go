package platform_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

func TestLoadConfigDefaultsAndValidation(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("HTTP_PORT", "")
	t.Setenv("ADMIN_PORT", "")
	t.Setenv("FAULT_ERROR_RATE", "")
	t.Setenv("FAULT_LATENCY_MS", "")
	t.Setenv("SHUTDOWN_DELAY", "")

	cfg, err := platform.LoadConfig("catalog")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AppEnv != "local" || cfg.HTTPPort != 8080 || cfg.AdminPort != 9090 {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}

	t.Setenv("APP_ENV", "invalid")
	if _, err := platform.LoadConfig("catalog"); err == nil {
		t.Fatal("expected error for invalid APP_ENV")
	}

	t.Setenv("APP_ENV", "dev")
	t.Setenv("FAULT_ERROR_RATE", "1.5")
	if _, err := platform.LoadConfig("catalog"); err == nil {
		t.Fatal("expected error for invalid FAULT_ERROR_RATE")
	}
}

func TestMiddlewareChainAndFaultInjection(t *testing.T) {
	cfg := platform.Config{
		ServiceName:    "catalog",
		AppEnv:         "local",
		AppVersion:     "dev",
		AppGitSHA:      "local",
		PodName:        "test-pod",
		FaultErrorRate: 1.0,
		FaultLatencyMs: 5,
	}
	var logBuf bytes.Buffer
	logger := platform.NewLogger(cfg, &logBuf)
	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	r := platform.NewRouter(cfg, logger, metrics)

	r.Get("/api/catalog/version", platform.VersionHandler(cfg))
	r.Get("/api/catalog/test", func(w http.ResponseWriter, _ *http.Request) {
		platform.WriteJSON(w, http.StatusOK, map[string]string{"ok": "true"})
	})
	r.Get("/api/catalog/panic", func(_ http.ResponseWriter, _ *http.Request) {
		panic("boom")
	})

	// /version must be exempt from fault injection
	req := httptest.NewRequest(http.MethodGet, "/api/catalog/version", nil)
	req.Header.Set("X-Request-ID", "req-123")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /version, got %d", rec.Code)
	}
	if rec.Header().Get("X-Request-ID") != "req-123" {
		t.Fatalf("expected echoed X-Request-ID, got %q", rec.Header().Get("X-Request-ID"))
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("expected Cache-Control: no-store, got %q", rec.Header().Get("Cache-Control"))
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("expected nosniff header")
	}

	// /api/catalog/test must return 500 FAULT_INJECTED
	req2 := httptest.NewRequest(http.MethodGet, "/api/catalog/test", nil)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 FAULT_INJECTED, got %d", rec2.Code)
	}
	var errEnv platform.ErrorEnvelope
	if err := json.NewDecoder(rec2.Body).Decode(&errEnv); err != nil {
		t.Fatalf("decode error envelope: %v", err)
	}
	if errEnv.Error.Code != platform.CodeFaultInjected || errEnv.Error.RequestID == "" {
		t.Fatalf("unexpected fault error payload: %+v", errEnv)
	}
}

func TestRequireSessionAndDecodeJSON(t *testing.T) {
	cfg := platform.Config{ServiceName: "cart", AppEnv: "local", AppVersion: "dev"}
	logger := platform.NewLogger(cfg, io.Discard)
	r := platform.NewRouter(cfg, logger, nil)

	type sampleReq struct {
		Name string `json:"name"`
	}
	r.With(platform.RequireSession).Post("/api/cart/test", func(w http.ResponseWriter, r *http.Request) {
		var body sampleReq
		if details := platform.DecodeJSON(r, &body); len(details) > 0 {
			platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
			return
		}
		platform.WriteJSON(w, http.StatusOK, map[string]string{"session": platform.SessionIDFromContext(r.Context())})
	})

	// Missing session
	req := httptest.NewRequest(http.MethodPost, "/api/cart/test", strings.NewReader(`{"name":"ok"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 MISSING_SESSION, got %d", rec.Code)
	}

	// Unknown JSON field rejected
	req2 := httptest.NewRequest(http.MethodPost, "/api/cart/test", strings.NewReader(`{"name":"ok","extra":1}`))
	req2.Header.Set("X-Session-ID", uuid.NewString())
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 VALIDATION_ERROR on unknown field, got %d", rec2.Code)
	}

	// Valid request succeeds
	req3 := httptest.NewRequest(http.MethodPost, "/api/cart/test", strings.NewReader(`{"name":"ok"}`))
	req3.Header.Set("X-Session-ID", uuid.NewString())
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec3.Code)
	}
}

func TestAdminMux(t *testing.T) {
	reg := platform.NewRegistry()
	var ready atomic.Bool
	ready.Store(true)

	var depErr error
	mux := platform.NewAdminMux(reg, &ready, func(_ context.Context) error { return depErr })

	// /healthz
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 /healthz, got %d", rec.Code)
	}

	// /readyz ok
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 /readyz, got %d", rec.Code)
	}

	// /readyz dep failure
	depErr = errors.New("db down")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 /readyz on dep failure, got %d", rec.Code)
	}

	// /readyz shutdown
	depErr = nil
	ready.Store(false)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 /readyz during shutdown, got %d", rec.Code)
	}

	// /metrics
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "go_goroutines") {
		t.Fatalf("expected 200 /metrics with go_goroutines, got %d", rec.Code)
	}
}

func TestNotFoundMethodNotAllowedAndTracingNoop(t *testing.T) {
	cfg := platform.Config{ServiceName: "catalog", AppEnv: "local", AppVersion: "dev", LogLevel: "debug"}
	logger := platform.NewLogger(cfg, io.Discard)
	r := platform.NewRouter(cfg, logger, nil)
	r.Get("/api/catalog/onlyget", func(w http.ResponseWriter, _ *http.Request) {
		platform.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	rec404 := httptest.NewRecorder()
	r.ServeHTTP(rec404, httptest.NewRequest(http.MethodGet, "/api/catalog/missing", nil))
	if rec404.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec404.Code)
	}

	rec405 := httptest.NewRecorder()
	r.ServeHTTP(rec405, httptest.NewRequest(http.MethodPost, "/api/catalog/onlyget", nil))
	if rec405.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec405.Code)
	}

	shutdown, err := platform.InitTracing(context.Background(), cfg)
	if err != nil {
		t.Fatalf("InitTracing noop failed: %v", err)
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown noop failed: %v", err)
	}

	if !platform.IsUUID(uuid.NewString()) || platform.IsUUID("not-a-uuid") {
		t.Fatalf("unexpected IsUUID behavior")
	}
	if platform.EnvOrDefault("NON_EXISTENT_KUBESHOP_ENV", "fallback") != "fallback" {
		t.Fatalf("unexpected EnvOrDefault behavior")
	}
}

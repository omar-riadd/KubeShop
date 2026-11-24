package platform

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand/v2" // nosemgrep: go.lang.security.audit.crypto.math_random.math-random-used -- non-cryptographic fault injection
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/time/rate"
)

type ctxKey string

const (
	ctxKeyRequestID ctxKey = "requestId"
	ctxKeySessionID ctxKey = "sessionId"

	// MaxRequestBodyBytes is the 16 KiB request body limit (§1.6).
	MaxRequestBodyBytes = 16 * 1024
)

var requestIDRegex = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// RequestIDFromContext extracts the request ID stored by RequestIDMiddleware.
func RequestIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyRequestID).(string); ok {
		return v
	}
	return ""
}

// SessionIDFromContext extracts the validated UUID v4 session ID stored by RequireSession.
func SessionIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeySessionID).(string); ok {
		return v
	}
	return ""
}

// HTTPMetrics holds Prometheus metrics for HTTP handlers.
type HTTPMetrics struct {
	RequestsTotal   *prometheus.CounterVec
	RequestDuration *prometheus.HistogramVec
	InFlight        prometheus.Gauge
}

// NewHTTPMetrics registers standard HTTP metrics on the provided registerer.
func NewHTTPMetrics(reg prometheus.Registerer, serviceName string) *HTTPMetrics {
	m := &HTTPMetrics{
		RequestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name:        "http_requests_total",
			Help:        "Total number of HTTP requests.",
			ConstLabels: prometheus.Labels{"service": serviceName},
		}, []string{"method", "route", "status"}),
		RequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:        "http_request_duration_seconds",
			Help:        "HTTP request duration in seconds.",
			ConstLabels: prometheus.Labels{"service": serviceName},
			Buckets:     []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2.5, 5},
		}, []string{"method", "route"}),
		InFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Name:        "http_requests_in_flight",
			Help:        "Current number of HTTP requests being served.",
			ConstLabels: prometheus.Labels{"service": serviceName},
		}),
	}
	reg.MustRegister(m.RequestsTotal, m.RequestDuration, m.InFlight)
	return m
}

// NewRouter creates a chi.Router pre-wired with the exact §6.1 middleware chain:
// recover -> request-id -> otelhttp -> access log -> metrics -> security headers -> fault injection -> body limit.
func NewRouter(cfg Config, logger *slog.Logger, metrics *HTTPMetrics) *chi.Mux {
	r := chi.NewRouter()

	r.Use(RecoverMiddleware(logger))
	r.Use(RequestIDMiddleware)
	r.Use(func(next http.Handler) http.Handler {
		return otelhttp.NewHandler(next, cfg.ServiceName, otelhttp.WithSpanNameFormatter(func(_ string, req *http.Request) string {
			return req.Method + " " + req.URL.Path
		}))
	})
	r.Use(AccessLogMiddleware(logger))
	if metrics != nil {
		r.Use(MetricsMiddleware(metrics))
	}
	r.Use(SecurityHeadersMiddleware)
	r.Use(FaultInjectionMiddleware(cfg.FaultErrorRate, cfg.FaultLatencyMs))
	r.Use(BodyLimitMiddleware(MaxRequestBodyBytes))

	r.NotFound(NotFoundHandler)
	r.MethodNotAllowed(MethodNotAllowedHandler)

	return r
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

// RecoverMiddleware catches panics and returns a 500 INTERNAL_ERROR JSON response.
func RecoverMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error("panic recovered",
						slog.String("requestId", RequestIDFromContext(r.Context())),
						slog.String("panic", fmt.Sprint(rec)),
					)
					WriteError(w, r, http.StatusInternalServerError, CodeInternalError, "An unexpected error occurred")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// RequestIDMiddleware validates or generates X-Request-ID, stores it in context, and echoes it in the response.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if !requestIDRegex.MatchString(reqID) {
			reqID = uuid.NewString()
		}
		w.Header().Set("X-Request-ID", reqID)
		ctx := context.WithValue(r.Context(), ctxKeyRequestID, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AccessLogMiddleware logs each HTTP request in JSON format without logging request bodies or emails.
func AccessLogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			durationMs := float64(time.Since(start).Microseconds()) / 1000.0
			route := routePattern(r)
			spanCtx := trace.SpanContextFromContext(r.Context())

			attrs := []any{
				slog.String("requestId", RequestIDFromContext(r.Context())),
				slog.String("method", r.Method),
				slog.String("route", route),
				slog.Int("status", rec.status),
				slog.Float64("durationMs", durationMs),
			}
			if spanCtx.IsValid() {
				attrs = append(attrs,
					slog.String("traceId", spanCtx.TraceID().String()),
					slog.String("spanId", spanCtx.SpanID().String()),
				)
			}
			logger.Info("http request", attrs...)
		})
	}
}

// MetricsMiddleware records request counts, durations, and in-flight gauge using chi route patterns.
func MetricsMiddleware(m *HTTPMetrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			m.InFlight.Inc()
			defer m.InFlight.Dec()

			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			route := routePattern(r)
			m.RequestsTotal.WithLabelValues(r.Method, route, strconv.Itoa(rec.status)).Inc()
			m.RequestDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
		})
	}
}

// SecurityHeadersMiddleware sets standard API response security headers (§1.11).
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// FaultInjectionMiddleware injects configurable latency and 500 FAULT_INJECTED errors on /api/* except /version (§1.13).
func FaultInjectionMiddleware(errorRate float64, latencyMs int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isFaultExempt(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}
			if latencyMs > 0 {
				timer := time.NewTimer(time.Duration(latencyMs) * time.Millisecond)
				select {
				case <-timer.C:
				case <-r.Context().Done():
					timer.Stop()
					return
				}
			}
			if errorRate > 0 && rand.Float64() < errorRate {
				WriteError(w, r, http.StatusInternalServerError, CodeFaultInjected, "Injected fault")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isFaultExempt(path string) bool {
	return strings.HasSuffix(path, "/version") || !strings.HasPrefix(path, "/api/")
}

// BodyLimitMiddleware enforces the 16 KiB request body size limit (§1.6).
func BodyLimitMiddleware(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireSession validates that X-Session-ID is present and a valid UUID v4 (§1.6).
func RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimSpace(r.Header.Get("X-Session-ID"))
		if raw == "" || !IsUUIDv4(raw) {
			WriteError(w, r, http.StatusBadRequest, CodeMissingSession, "X-Session-ID header is required and must be a valid UUID v4")
			return
		}
		ctx := context.WithValue(r.Context(), ctxKeySessionID, strings.ToLower(raw))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// IsUUIDv4 checks whether s parses as a valid RFC 4122 version 4 UUID.
func IsUUIDv4(s string) bool {
	u, err := uuid.Parse(s)
	if err != nil {
		return false
	}
	return u.Version() == 4 && u.Variant() == uuid.RFC4122
}

// IsUUID checks whether s parses as any valid UUID.
func IsUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

func routePattern(r *http.Request) string {
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		if pattern := rctx.RoutePattern(); pattern != "" {
			return pattern
		}
	}
	return "unmatched"
}

type sessionLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen atomic.Int64
}

// SessionRateLimiter manages in-memory token bucket rate limiters keyed by session ID (or IP fallback).
// Inactive limiters are periodically evicted to prevent unbounded memory growth.
type SessionRateLimiter struct {
	limiters sync.Map
	rate     rate.Limit
	burst    int
	ttl      time.Duration
	stopCh   chan struct{}
}

// NewSessionRateLimiter creates a per-session token bucket rate limiter.
// rps specifies allowed requests per second, burst specifies maximum burst size,
// and ttl specifies how long inactive limiters remain in memory before eviction.
func NewSessionRateLimiter(rps, burst int, ttl time.Duration) *SessionRateLimiter {
	if ttl <= 0 {
		ttl = 3 * time.Minute
	}
	rl := &SessionRateLimiter{
		rate:   rate.Limit(rps),
		burst:  burst,
		ttl:    ttl,
		stopCh: make(chan struct{}),
	}
	interval := ttl / 2
	if interval < 100*time.Millisecond {
		interval = 100 * time.Millisecond
	}
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ticker.C:
				rl.cleanup()
			case <-rl.stopCh:
				ticker.Stop()
				return
			}
		}
	}()
	return rl
}

// Close stops the background eviction goroutine.
func (rl *SessionRateLimiter) Close() {
	select {
	case <-rl.stopCh:
	default:
		close(rl.stopCh)
	}
}

func (rl *SessionRateLimiter) cleanup() {
	now := time.Now().Unix()
	ttlSec := int64(rl.ttl.Seconds())
	rl.limiters.Range(func(key, value any) bool {
		entry := value.(*sessionLimiterEntry)
		if now-entry.lastSeen.Load() > ttlSec {
			rl.limiters.Delete(key)
		}
		return true
	})
}

// Allow reports whether a request for the given session key is allowed under the rate limit.
func (rl *SessionRateLimiter) Allow(key string) bool {
	now := time.Now().Unix()
	val, loaded := rl.limiters.Load(key)
	if !loaded {
		val, _ = rl.limiters.LoadOrStore(key, &sessionLimiterEntry{
			limiter: rate.NewLimiter(rl.rate, rl.burst),
		})
	}
	entry := val.(*sessionLimiterEntry)
	entry.lastSeen.Store(now)
	return entry.limiter.Allow()
}

// Middleware returns an HTTP middleware enforcing the rate limit per session or client key.
func (rl *SessionRateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := sessionOrClientKey(r)
			if !rl.Allow(key) {
				w.Header().Set("Retry-After", "1")
				WriteError(w, r, http.StatusTooManyRequests, CodeRateLimitExceeded, "Rate limit exceeded")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func sessionOrClientKey(r *http.Request) string {
	if sess := SessionIDFromContext(r.Context()); sess != "" {
		return "session:" + sess
	}
	if raw := strings.TrimSpace(r.Header.Get("X-Session-ID")); raw != "" && IsUUIDv4(raw) {
		return "session:" + strings.ToLower(raw)
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return "ip:" + realIP
	}
	return "ip:" + r.RemoteAddr
}

// SessionRateLimitMiddleware is a convenience constructor creating a per-session rate limiter
// with rps requests per second and burst capacity.
func SessionRateLimitMiddleware(rps, burst int) func(http.Handler) http.Handler {
	rl := NewSessionRateLimiter(rps, burst, 3*time.Minute)
	return rl.Middleware()
}


package platform

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSessionRateLimitMiddleware_BurstAndThrottle(t *testing.T) {
	rl := NewSessionRateLimiter(2, 5, time.Minute)
	defer rl.Close()

	handler := rl.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	sessionID := uuid.NewString()

	// First 5 requests (burst capacity) should pass.
	for i := 1; i <= 5; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/orders", nil)
		req.Header.Set("X-Session-ID", sessionID)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, rr.Code)
		}
	}

	// 6th request within the same second should be throttled with 429.
	req := httptest.NewRequest(http.MethodPost, "/api/orders", nil)
	req.Header.Set("X-Session-ID", sessionID)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("6th request: expected 429, got %d", rr.Code)
	}
	if retryAfter := rr.Header().Get("Retry-After"); retryAfter != "1" {
		t.Fatalf("expected Retry-After header '1', got %q", retryAfter)
	}

	var errEnv ErrorEnvelope
	if err := json.NewDecoder(rr.Body).Decode(&errEnv); err != nil {
		t.Fatalf("decode 429 error response: %v", err)
	}
	if errEnv.Error.Code != CodeRateLimitExceeded {
		t.Fatalf("expected error code %q, got %q", CodeRateLimitExceeded, errEnv.Error.Code)
	}

	// Another session should not be affected by the first session's throttling.
	otherSession := uuid.NewString()
	reqOther := httptest.NewRequest(http.MethodPost, "/api/orders", nil)
	reqOther.Header.Set("X-Session-ID", otherSession)
	rrOther := httptest.NewRecorder()
	handler.ServeHTTP(rrOther, reqOther)

	if rrOther.Code != http.StatusOK {
		t.Fatalf("other session request: expected 200, got %d", rrOther.Code)
	}
}

func TestSessionOrClientKey_Resolution(t *testing.T) {
	// 1. Session from context
	sessID := uuid.NewString()
	reqCtx := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(reqCtx.Context(), ctxKeySessionID, sessID)
	reqCtx = reqCtx.WithContext(ctx)
	if got := sessionOrClientKey(reqCtx); got != "session:"+sessID {
		t.Fatalf("expected session:%s, got %s", sessID, got)
	}

	// 2. Session from header
	reqHdr := httptest.NewRequest(http.MethodGet, "/", nil)
	reqHdr.Header.Set("X-Session-ID", sessID)
	if got := sessionOrClientKey(reqHdr); got != "session:"+sessID {
		t.Fatalf("expected session:%s, got %s", sessID, got)
	}

	// 3. X-Real-IP takes precedence over spoofed X-Forwarded-For and RemoteAddr
	reqRealIP := httptest.NewRequest(http.MethodGet, "/", nil)
	reqRealIP.RemoteAddr = "10.0.0.1:12345"
	reqRealIP.Header.Set("X-Real-IP", "203.0.113.195")
	reqRealIP.Header.Set("X-Forwarded-For", "1.1.1.1, 2.2.2.2")
	if got := sessionOrClientKey(reqRealIP); got != "ip:203.0.113.195" {
		t.Fatalf("expected ip:203.0.113.195, got %s", got)
	}

	// 4. Spoofed X-Forwarded-For without X-Real-IP is ignored and falls back to RemoteAddr
	reqSpoofXFF := httptest.NewRequest(http.MethodGet, "/", nil)
	reqSpoofXFF.RemoteAddr = "198.51.100.1:45678"
	reqSpoofXFF.Header.Set("X-Forwarded-For", "1.1.1.1, 2.2.2.2")
	if got := sessionOrClientKey(reqSpoofXFF); got != "ip:198.51.100.1:45678" {
		t.Fatalf("expected ip:198.51.100.1:45678, got %s", got)
	}

	// 5. RemoteAddr fallback
	reqAddr := httptest.NewRequest(http.MethodGet, "/", nil)
	reqAddr.RemoteAddr = "198.51.100.1:45678"
	if got := sessionOrClientKey(reqAddr); got != "ip:198.51.100.1:45678" {
		t.Fatalf("expected ip:198.51.100.1:45678, got %s", got)
	}
}

func TestSessionRateLimiter_EvictionAndClose(t *testing.T) {
	// Create limiter with very short TTL
	rl := NewSessionRateLimiter(10, 10, 50*time.Millisecond)
	key := "test-session"
	if !rl.Allow(key) {
		t.Fatal("expected Allow to be true")
	}

	// Verify key exists
	if _, loaded := rl.limiters.Load(key); !loaded {
		t.Fatal("expected key to exist in map")
	}

	// Manually age the entry to simulate passage of time beyond TTL
	val, _ := rl.limiters.Load(key)
	entry := val.(*sessionLimiterEntry)
	entry.lastSeen.Store(time.Now().Unix() - 100)

	rl.cleanup()

	if _, loaded := rl.limiters.Load(key); loaded {
		t.Fatal("expected stale key to be evicted by cleanup")
	}

	// Idempotent close
	rl.Close()
	rl.Close()
}

func TestSessionRateLimitMiddleware_ConvenienceConstructor(t *testing.T) {
	mw := SessionRateLimitMiddleware(2, 5)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("X-Session-ID", uuid.NewString())
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

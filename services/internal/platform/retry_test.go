package platform

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestWithRetry_SucceedsAfterTransient503(t *testing.T) {
	var attempts atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if attempts.Add(1) < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	err := WithRetry(context.Background(), 3, func() error {
		resp, err := srv.Client().Get(srv.URL)
		if err != nil {
			return err
		}
		_ = resp.Body.Close()
		if resp.StatusCode >= 500 {
			return errors.New("upstream 503")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected nil error after 2 transient 503s, got %v", err)
	}
	if got := attempts.Load(); got != 3 {
		t.Fatalf("expected 3 attempts, got %d", got)
	}
}

func TestWithRetry_ExhaustsMaxAttempts(t *testing.T) {
	var attempts int
	sentinel := errors.New("always 503")
	err := WithRetryBackoff(context.Background(), 3, time.Millisecond, 2*time.Millisecond, func() error {
		attempts++
		return sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestWithRetry_PermanentStopsImmediately(t *testing.T) {
	if Permanent(nil) != nil {
		t.Fatal("Permanent(nil) must return nil")
	}

	var attempts int
	notFound := errors.New("404 not found")
	wrapped := Permanent(notFound)
	if wrapped.Error() != notFound.Error() || !errors.Is(wrapped, notFound) {
		t.Fatalf("unexpected wrapped error: %v", wrapped)
	}

	err := WithRetryBackoff(context.Background(), 3, time.Millisecond, 5*time.Millisecond, func() error {
		attempts++
		return Permanent(notFound)
	})
	if !errors.Is(err, notFound) {
		t.Fatalf("expected notFound error, got %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected 1 attempt on Permanent error, got %d", attempts)
	}
}

func TestWithRetry_ContextCancelledMidRetry(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var attempts int
	err := WithRetryBackoff(ctx, 3, 200*time.Millisecond, time.Second, func() error {
		attempts++
		go func() {
			time.Sleep(10 * time.Millisecond)
			cancel()
		}()
		return errors.New("transient")
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected 1 attempt before cancel, got %d", attempts)
	}
}

func TestWithRetry_ZeroAttemptsDefaultsToOne(t *testing.T) {
	var attempts int
	err := WithRetryBackoff(context.Background(), 0, time.Millisecond, time.Millisecond, func() error {
		attempts++
		return nil
	})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected 1 attempt, got %d", attempts)
	}
}

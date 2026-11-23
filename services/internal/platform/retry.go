package platform

import (
	"context"
	"errors"
	"math/rand/v2" // nosemgrep: go.lang.security.audit.crypto.math_random.math-random-used -- non-cryptographic retry jitter
	"time"
)

const (
	defaultRetryBaseDelay = 100 * time.Millisecond
	defaultRetryMaxDelay  = 5 * time.Second
)

type permanentError struct {
	err error
}

func (e permanentError) Error() string { return e.err.Error() }
func (e permanentError) Unwrap() error { return e.err }

// Permanent wraps err to signal WithRetry that it must not be retried (e.g. 4xx responses).
func Permanent(err error) error {
	if err == nil {
		return nil
	}
	return permanentError{err: err}
}

// WithRetry executes fn up to maxAttempts times with exponential backoff (100ms base, 5s cap)
// and random jitter. Errors wrapped with Permanent stop retries immediately.
func WithRetry(ctx context.Context, maxAttempts int, fn func() error) error {
	return WithRetryBackoff(ctx, maxAttempts, defaultRetryBaseDelay, defaultRetryMaxDelay, fn)
}

// WithRetryBackoff executes fn up to maxAttempts times with configurable base and max backoff delays.
func WithRetryBackoff(ctx context.Context, maxAttempts int, baseDelay, maxDelay time.Duration, fn func() error) error {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	delay := baseDelay

	for attempt := 0; ; attempt++ {
		err := fn()
		if err == nil {
			return nil
		}
		var perm permanentError
		if errors.As(err, &perm) {
			return perm.err
		}
		if attempt >= maxAttempts-1 {
			return err
		}

		var jitter time.Duration
		if half := int64(delay / 2); half > 0 {
			jitter = time.Duration(rand.Int64N(half))
		}
		timer := time.NewTimer(delay + jitter)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
		delay = min(delay*2, maxDelay)
	}
}

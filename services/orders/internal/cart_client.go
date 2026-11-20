package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

var (
	ErrCartUpstreamTimeout     = errors.New("cart upstream timeout")
	ErrCartUpstreamUnavailable = errors.New("cart upstream unavailable")
)

// CartItem represents a line item returned by the cart service.
type CartItem struct {
	ProductID      string `json:"productId"`
	Name           string `json:"name"`
	PriceCents     int    `json:"priceCents"`
	Quantity       int    `json:"quantity"`
	LineTotalCents int    `json:"lineTotalCents"`
}

// CartSnapshot represents the cart returned by GET /api/cart.
type CartSnapshot struct {
	Items         []CartItem `json:"items"`
	ItemCount     int        `json:"itemCount"`
	SubtotalCents int        `json:"subtotalCents"`
	Currency      string     `json:"currency"`
}

// CartClient reads and clears the user's cart in the cart service.
type CartClient interface {
	GetCart(ctx context.Context, sessionID string) (CartSnapshot, error)
	ClearCart(ctx context.Context, sessionID string) error
}

// HTTPCartClient implements CartClient over HTTP.
type HTTPCartClient struct {
	baseURL string
	client  *http.Client
	timeout time.Duration
}

// NewHTTPCartClient constructs a CartClient with a 2s timeout (§1.8).
func NewHTTPCartClient(baseURL string, client *http.Client) *HTTPCartClient {
	if client == nil {
		client = platform.NewHTTPClient(2 * time.Second)
	}
	return &HTTPCartClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  client,
		timeout: 2 * time.Second,
	}
}

// GetCart calls GET {CART_BASE_URL}/api/cart forwarding X-Session-ID and X-Request-ID.
func (c *HTTPCartClient) GetCart(ctx context.Context, sessionID string) (CartSnapshot, error) {
	reqCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, c.baseURL+"/api/cart", nil) //nolint:gosec // trusted internal service URL
	if err != nil {
		return CartSnapshot{}, ErrCartUpstreamUnavailable
	}
	req.Header.Set("X-Session-ID", sessionID)
	if reqID := platform.RequestIDFromContext(ctx); reqID != "" {
		req.Header.Set("X-Request-ID", reqID)
	}

	resp, err := c.client.Do(req) //nolint:gosec // trusted internal service URL
	if err != nil {
		if isTimeoutErr(err) || errors.Is(reqCtx.Err(), context.DeadlineExceeded) {
			return CartSnapshot{}, ErrCartUpstreamTimeout
		}
		return CartSnapshot{}, ErrCartUpstreamUnavailable
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return CartSnapshot{}, ErrCartUpstreamUnavailable
	}

	var cart CartSnapshot
	if err := json.NewDecoder(resp.Body).Decode(&cart); err != nil {
		return CartSnapshot{}, fmt.Errorf("%w: decode cart: %v", ErrCartUpstreamUnavailable, err)
	}
	return cart, nil
}

// ClearCart calls DELETE {CART_BASE_URL}/api/cart (best-effort after order creation).
func (c *HTTPCartClient) ClearCart(ctx context.Context, sessionID string) error {
	reqCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodDelete, c.baseURL+"/api/cart", nil) //nolint:gosec // trusted internal service URL
	if err != nil {
		return err
	}
	req.Header.Set("X-Session-ID", sessionID)
	if reqID := platform.RequestIDFromContext(ctx); reqID != "" {
		req.Header.Set("X-Request-ID", reqID)
	}

	resp, err := c.client.Do(req) //nolint:gosec // trusted internal service URL
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("cart delete returned status %d", resp.StatusCode)
	}
	return nil
}

func isTimeoutErr(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

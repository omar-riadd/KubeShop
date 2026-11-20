package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

var (
	ErrProductNotFound     = errors.New("product not found")
	ErrUpstreamTimeout     = errors.New("upstream timeout")
	ErrUpstreamUnavailable = errors.New("upstream unavailable")
)

// CatalogProduct represents the product fields needed by cart when snapshotting an item.
type CatalogProduct struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	PriceCents int    `json:"priceCents"`
	Currency   string `json:"currency"`
	ImageURL   string `json:"imageUrl"`
}

// CatalogClient fetches product metadata from the catalog service.
type CatalogClient interface {
	GetProduct(ctx context.Context, productID string) (CatalogProduct, error)
}

// HTTPCatalogClient implements CatalogClient over HTTP with timeout and retry.
type HTTPCatalogClient struct {
	baseURL string
	client  *http.Client
	timeout time.Duration
}

// NewHTTPCatalogClient constructs a CatalogClient with a 2s per-attempt timeout (§6.4).
func NewHTTPCatalogClient(baseURL string, client *http.Client) *HTTPCatalogClient {
	if client == nil {
		client = platform.NewHTTPClient(2 * time.Second)
	}
	return &HTTPCatalogClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  client,
		timeout: 2 * time.Second,
	}
}

// GetProduct calls GET {CATALOG_BASE_URL}/api/catalog/products/{id} with 2s timeout and 1 retry with jitter on timeout or 5xx.
func (c *HTTPCatalogClient) GetProduct(ctx context.Context, productID string) (CatalogProduct, error) {
	endpoint := fmt.Sprintf("%s/api/catalog/products/%s", c.baseURL, url.PathEscape(productID))

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			jitter := time.Duration(30+rand.IntN(70)) * time.Millisecond
			timer := time.NewTimer(jitter)
			select {
			case <-timer.C:
			case <-ctx.Done():
				timer.Stop()
				return CatalogProduct{}, ErrUpstreamTimeout
			}
		}

		reqCtx, cancel := context.WithTimeout(ctx, c.timeout)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, endpoint, nil) //nolint:gosec // trusted internal service URL
		if err != nil {
			cancel()
			return CatalogProduct{}, fmt.Errorf("%w: %v", ErrUpstreamUnavailable, err)
		}
		if reqID := platform.RequestIDFromContext(ctx); reqID != "" {
			req.Header.Set("X-Request-ID", reqID)
		}

		resp, err := c.client.Do(req) //nolint:gosec // trusted internal service URL
		if err != nil {
			cancel()
			if isTimeoutErr(err) || errors.Is(reqCtx.Err(), context.DeadlineExceeded) {
				lastErr = ErrUpstreamTimeout
				continue
			}
			lastErr = ErrUpstreamUnavailable
			continue
		}

		var product CatalogProduct
		switch {
		case resp.StatusCode == http.StatusOK:
			decErr := json.NewDecoder(resp.Body).Decode(&product)
			_ = resp.Body.Close()
			cancel()
			if decErr != nil {
				return CatalogProduct{}, ErrUpstreamUnavailable
			}
			return product, nil
		case resp.StatusCode == http.StatusNotFound:
			_ = resp.Body.Close()
			cancel()
			return CatalogProduct{}, ErrProductNotFound
		case resp.StatusCode >= 500:
			_ = resp.Body.Close()
			cancel()
			lastErr = ErrUpstreamUnavailable
			continue
		default:
			_ = resp.Body.Close()
			cancel()
			return CatalogProduct{}, ErrUpstreamUnavailable
		}
	}

	if lastErr != nil {
		return CatalogProduct{}, lastErr
	}
	return CatalogProduct{}, ErrUpstreamUnavailable
}

func isTimeoutErr(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

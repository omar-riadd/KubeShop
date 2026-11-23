package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// GetProduct calls GET {CATALOG_BASE_URL}/api/catalog/products/{id} with 2s per-attempt timeout
// and up to 3 attempts with exponential backoff + jitter on timeout, network error, or 5xx.
func (c *HTTPCatalogClient) GetProduct(ctx context.Context, productID string) (CatalogProduct, error) {
	endpoint := fmt.Sprintf("%s/api/catalog/products/%s", c.baseURL, url.PathEscape(productID))

	var product CatalogProduct
	err := platform.WithRetry(ctx, 3, func() error {
		reqCtx, cancel := context.WithTimeout(ctx, c.timeout)
		defer cancel()

		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, endpoint, nil) //nolint:gosec // trusted internal service URL
		if err != nil {
			return platform.Permanent(fmt.Errorf("%w: %v", ErrUpstreamUnavailable, err))
		}
		if reqID := platform.RequestIDFromContext(ctx); reqID != "" {
			req.Header.Set("X-Request-ID", reqID)
		}

		resp, err := c.client.Do(req) //nolint:gosec // trusted internal service URL
		if err != nil {
			if isTimeoutErr(err) || errors.Is(reqCtx.Err(), context.DeadlineExceeded) {
				return ErrUpstreamTimeout
			}
			return ErrUpstreamUnavailable
		}
		defer func() { _ = resp.Body.Close() }()

		switch {
		case resp.StatusCode == http.StatusOK:
			if decErr := json.NewDecoder(resp.Body).Decode(&product); decErr != nil {
				return platform.Permanent(ErrUpstreamUnavailable)
			}
			return nil
		case resp.StatusCode == http.StatusNotFound:
			return platform.Permanent(ErrProductNotFound)
		case resp.StatusCode >= 500:
			return ErrUpstreamUnavailable
		default:
			return platform.Permanent(ErrUpstreamUnavailable)
		}
	})
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return CatalogProduct{}, ErrUpstreamTimeout
		}
		return CatalogProduct{}, err
	}
	return product, nil
}

func isTimeoutErr(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

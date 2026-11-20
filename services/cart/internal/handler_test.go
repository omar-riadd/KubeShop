package internal_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/kubeshop/kubeshop-platform/services/cart/internal"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform/contracttest"
	"github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
)

func startRedisContainer(t *testing.T) *redis.Client {
	t.Helper()
	ctx := context.Background()
	container, err := tcredis.Run(ctx, "redis:7-alpine")
	if err != nil {
		t.Fatalf("start redis container: %v", err)
	}
	t.Cleanup(func() {
		_ = testcontainers.TerminateContainer(container)
	})

	connStr, err := container.ConnectionString(ctx)
	if err != nil {
		t.Fatalf("redis connection string: %v", err)
	}
	opts, err := redis.ParseURL(connStr)
	if err != nil {
		t.Fatalf("parse redis url: %v", err)
	}
	rdb := redis.NewClient(opts)
	t.Cleanup(func() { _ = rdb.Close() })
	return rdb
}

func newStubCatalogServer(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/catalog/products/kb-001":
			platform.WriteJSON(w, http.StatusOK, internal.CatalogProduct{
				ID:         "kb-001",
				Name:       "Nimbus 75 Mechanical Keyboard",
				PriceCents: 8900,
				Currency:   "USD",
				ImageURL:   "/images/products/kb-001.svg",
			})
		case "/api/catalog/products/ms-001":
			platform.WriteJSON(w, http.StatusOK, internal.CatalogProduct{
				ID:         "ms-001",
				Name:       "Orbit Ergonomic Mouse",
				PriceCents: 5900,
				Currency:   "USD",
				ImageURL:   "/images/products/ms-001.svg",
			})
		case "/api/catalog/products/err-500":
			w.WriteHeader(http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestCartIntegrationAndContract(t *testing.T) {
	rdb := startRedisContainer(t)
	catalogSrv := newStubCatalogServer(t)

	cfg := platform.Config{
		ServiceName:  "cart",
		AppEnv:       "local",
		AppVersion:   "dev",
		AppGitSHA:    "local",
		AppBuildTime: "2026-11-20T09:58:00Z",
		PodName:      "cart-test",
	}
	logger := platform.NewLogger(cfg, io.Discard)
	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	router := platform.NewRouter(cfg, logger, metrics)

	store := internal.NewStore(rdb)
	catalogClient := internal.NewHTTPCatalogClient(catalogSrv.URL, catalogSrv.Client())
	h := internal.NewHandler(store, catalogClient, cfg, logger, reg)
	h.RegisterRoutes(router)

	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	client := srv.Client()

	sessionID := uuid.NewString()

	// 1. Missing session -> 400 MISSING_SESSION
	reqNoSess, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/cart", nil)
	respNoSess, err := client.Do(reqNoSess)
	if err != nil {
		t.Fatalf("GET cart without session: %v", err)
	}
	defer func() { _ = respNoSess.Body.Close() }()
	contracttest.AssertResponseValid(t, reqNoSess, respNoSess)
	if respNoSess.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", respNoSess.StatusCode)
	}

	// 2. Empty cart
	reqEmpty, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/cart", nil)
	reqEmpty.Header.Set("X-Session-ID", sessionID)
	respEmpty, err := client.Do(reqEmpty)
	if err != nil {
		t.Fatalf("GET empty cart: %v", err)
	}
	defer func() { _ = respEmpty.Body.Close() }()
	contracttest.AssertResponseValid(t, reqEmpty, respEmpty)
	if respEmpty.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respEmpty.StatusCode)
	}

	// 3. Add item kb-001 x2
	reqAdd, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/cart/items", bytes.NewBufferString(`{"productId":"kb-001","quantity":2}`))
	reqAdd.Header.Set("X-Session-ID", sessionID)
	reqAdd.Header.Set("Content-Type", "application/json")
	respAdd, err := client.Do(reqAdd)
	if err != nil {
		t.Fatalf("POST add item: %v", err)
	}
	defer func() { _ = respAdd.Body.Close() }()
	contracttest.AssertResponseValid(t, reqAdd, respAdd)
	if respAdd.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respAdd.StatusCode)
	}
	var cart internal.Cart
	if err := json.NewDecoder(respAdd.Body).Decode(&cart); err != nil {
		t.Fatalf("decode cart: %v", err)
	}
	if cart.ItemCount != 2 || cart.SubtotalCents != 17800 {
		t.Fatalf("unexpected cart totals: %+v", cart)
	}

	// 4. Exceeding quantity 20 -> 400 VALIDATION_ERROR
	reqMax, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/cart/items", bytes.NewBufferString(`{"productId":"kb-001","quantity":19}`))
	reqMax.Header.Set("X-Session-ID", sessionID)
	reqMax.Header.Set("Content-Type", "application/json")
	respMax, err := client.Do(reqMax)
	if err != nil {
		t.Fatalf("POST exceed max: %v", err)
	}
	defer func() { _ = respMax.Body.Close() }()
	contracttest.AssertResponseValid(t, reqMax, respMax)
	if respMax.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 when exceeding 20, got %d", respMax.StatusCode)
	}

	// 5. PUT absolute quantity
	reqPut, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/cart/items/ms-001", bytes.NewBufferString(`{"quantity":3}`))
	reqPut.Header.Set("X-Session-ID", sessionID)
	reqPut.Header.Set("Content-Type", "application/json")
	respPut, err := client.Do(reqPut)
	if err != nil {
		t.Fatalf("PUT set item: %v", err)
	}
	defer func() { _ = respPut.Body.Close() }()
	contracttest.AssertResponseValid(t, reqPut, respPut)
	if respPut.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respPut.StatusCode)
	}

	// 6. Unknown product -> 404 PRODUCT_NOT_FOUND
	req404, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/cart/items", bytes.NewBufferString(`{"productId":"zz-999","quantity":1}`))
	req404.Header.Set("X-Session-ID", sessionID)
	req404.Header.Set("Content-Type", "application/json")
	resp404, err := client.Do(req404)
	if err != nil {
		t.Fatalf("POST unknown product: %v", err)
	}
	defer func() { _ = resp404.Body.Close() }()
	contracttest.AssertResponseValid(t, req404, resp404)
	if resp404.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp404.StatusCode)
	}

	// 7. Upstream catalog 500 -> 502 UPSTREAM_UNAVAILABLE
	req502, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/cart/items", bytes.NewBufferString(`{"productId":"err-500","quantity":1}`))
	req502.Header.Set("X-Session-ID", sessionID)
	req502.Header.Set("Content-Type", "application/json")
	resp502, err := client.Do(req502)
	if err != nil {
		t.Fatalf("POST upstream 500: %v", err)
	}
	defer func() { _ = resp502.Body.Close() }()
	contracttest.AssertResponseValid(t, req502, resp502)
	if resp502.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", resp502.StatusCode)
	}

	// 8. DELETE item
	reqDelItem, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/cart/items/kb-001", nil)
	reqDelItem.Header.Set("X-Session-ID", sessionID)
	respDelItem, err := client.Do(reqDelItem)
	if err != nil {
		t.Fatalf("DELETE item: %v", err)
	}
	defer func() { _ = respDelItem.Body.Close() }()
	contracttest.AssertResponseValid(t, reqDelItem, respDelItem)
	if respDelItem.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respDelItem.StatusCode)
	}

	// 9. DELETE cart
	reqClear, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/cart", nil)
	reqClear.Header.Set("X-Session-ID", sessionID)
	respClear, err := client.Do(reqClear)
	if err != nil {
		t.Fatalf("DELETE cart: %v", err)
	}
	defer func() { _ = respClear.Body.Close() }()
	contracttest.AssertResponseValid(t, reqClear, respClear)
	if respClear.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respClear.StatusCode)
	}

	// 10. Version (no session required)
	reqVer, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/cart/version", nil)
	respVer, err := client.Do(reqVer)
	if err != nil {
		t.Fatalf("GET version: %v", err)
	}
	defer func() { _ = respVer.Body.Close() }()
	contracttest.AssertResponseValid(t, reqVer, respVer)
	if respVer.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respVer.StatusCode)
	}

	// 11. Store Ping + invalid quantity + unknown field
	if err := store.Ping(context.Background()); err != nil {
		t.Fatalf("expected Ping ok, got %v", err)
	}
	reqZero, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/cart/items", bytes.NewBufferString(`{"productId":"","quantity":0}`))
	reqZero.Header.Set("X-Session-ID", sessionID)
	reqZero.Header.Set("Content-Type", "application/json")
	respZero, err := client.Do(reqZero)
	if err != nil {
		t.Fatalf("POST invalid add: %v", err)
	}
	defer func() { _ = respZero.Body.Close() }()
	contracttest.AssertResponseValid(t, reqZero, respZero)
	if respZero.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", respZero.StatusCode)
	}

	reqBadPut, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/cart/items/kb-001", bytes.NewBufferString(`{"quantity":99}`))
	reqBadPut.Header.Set("X-Session-ID", sessionID)
	reqBadPut.Header.Set("Content-Type", "application/json")
	respBadPut, err := client.Do(reqBadPut)
	if err != nil {
		t.Fatalf("PUT invalid qty: %v", err)
	}
	defer func() { _ = respBadPut.Body.Close() }()
	contracttest.AssertResponseValid(t, reqBadPut, respBadPut)
	if respBadPut.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", respBadPut.StatusCode)
	}

	reqUnknownPut, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/cart/items/kb-001", bytes.NewBufferString(`{"quantity":1,"extra":true}`))
	reqUnknownPut.Header.Set("X-Session-ID", sessionID)
	reqUnknownPut.Header.Set("Content-Type", "application/json")
	respUnknownPut, err := client.Do(reqUnknownPut)
	if err != nil {
		t.Fatalf("PUT unknown field: %v", err)
	}
	defer func() { _ = respUnknownPut.Body.Close() }()
	contracttest.AssertResponseValid(t, reqUnknownPut, respUnknownPut)
	if respUnknownPut.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", respUnknownPut.StatusCode)
	}
}

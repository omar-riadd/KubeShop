package internal_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kubeshop/kubeshop-platform/services/cart/internal"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/redis/go-redis/v9"
)

func TestCartStoreAndClientErrorPaths(t *testing.T) {
	// 1. Test NewHTTPCatalogClient with nil client, malformed JSON, 400 status, and timeout/cancel.
	if c := internal.NewHTTPCatalogClient("http://localhost:9999/", nil); c == nil {
		t.Fatal("expected non-nil HTTPCatalogClient")
	}

	catalogSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/catalog/products/bad-json":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("{invalid-json"))
		case "/api/catalog/products/bad-status":
			w.WriteHeader(http.StatusBadRequest)
		case "/api/catalog/products/slow":
			time.Sleep(80 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		default:
			platform.WriteJSON(w, http.StatusOK, internal.CatalogProduct{
				ID:         "kb-001",
				Name:       "Keyboard",
				PriceCents: 1000,
				Currency:   "USD",
			})
		}
	}))
	t.Cleanup(catalogSrv.Close)

	catClient := internal.NewHTTPCatalogClient(catalogSrv.URL, catalogSrv.Client())

	if _, err := catClient.GetProduct(context.Background(), "bad-json"); !errors.Is(err, internal.ErrUpstreamUnavailable) {
		t.Fatalf("expected ErrUpstreamUnavailable on bad json, got %v", err)
	}
	if _, err := catClient.GetProduct(context.Background(), "bad-status"); !errors.Is(err, internal.ErrUpstreamUnavailable) {
		t.Fatalf("expected ErrUpstreamUnavailable on 400 status, got %v", err)
	}

	shortCtx, cancel := context.WithTimeout(context.Background(), 15*time.Millisecond)
	defer cancel()
	if _, err := catClient.GetProduct(shortCtx, "slow"); !errors.Is(err, internal.ErrUpstreamTimeout) {
		t.Fatalf("expected ErrUpstreamTimeout on deadline exceeded, got %v", err)
	}

	// 2. Test Store validation & existing-item SetItem / AddItem branches on real Redis.
	rdb := startRedisContainer(t)
	store := internal.NewStore(rdb)
	ctx := context.Background()
	sess := uuid.NewString()
	prod := internal.CatalogProduct{ID: "kb-001", Name: "Keyboard", PriceCents: 1000, Currency: "USD"}

	if _, err := store.AddItem(ctx, sess, prod, 0); !errors.Is(err, internal.ErrQuantityOutOfRange) {
		t.Fatalf("expected ErrQuantityOutOfRange on AddItem(0), got %v", err)
	}
	if _, err := store.SetItem(ctx, sess, prod, 0); !errors.Is(err, internal.ErrQuantityOutOfRange) {
		t.Fatalf("expected ErrQuantityOutOfRange on SetItem(0), got %v", err)
	}
	// First add item, then call SetItem on the same product ID so existingRaw branch executes.
	if _, err := store.AddItem(ctx, sess, prod, 2); err != nil {
		t.Fatalf("AddItem: %v", err)
	}
	if _, err := store.SetItem(ctx, sess, prod, 5); err != nil {
		t.Fatalf("SetItem existing: %v", err)
	}

	// 3. Corrupt stored JSON in Redis to cover buildCart unmarshal error.
	badSess := uuid.NewString()
	_ = rdb.HSet(ctx, "cart:"+badSess, "corrupt", "{bad-json").Err()
	if _, err := store.Get(ctx, badSess); err == nil {
		t.Fatal("expected unmarshal error from corrupted cart entry")
	}

	// 4. Close Redis client and test handler error paths (500 INTERNAL_ERROR & 504 UPSTREAM_TIMEOUT).
	closedRdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
	_ = closedRdb.Close()
	brokenStore := internal.NewStore(closedRdb)

	cfg := platform.Config{ServiceName: "cart", AppEnv: "local", AppVersion: "dev"}
	logger := platform.NewLogger(cfg, io.Discard)
	reg := platform.NewRegistry()
	router := platform.NewRouter(cfg, logger, nil)

	// Stub catalog client that can return ErrUpstreamTimeout for "timeout-prod"
	h := internal.NewHandler(brokenStore, &stubCatalog{delegate: catClient}, cfg, logger, reg)
	h.RegisterRoutes(router)

	// GET /api/cart with broken store -> 500
	reqGet := httptest.NewRequest(http.MethodGet, "/api/cart", nil)
	reqGet.Header.Set("X-Session-ID", sess)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)
	if recGet.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on broken store getCart, got %d", recGet.Code)
	}

	// POST /api/cart/items with broken store -> 500
	reqAdd := httptest.NewRequest(http.MethodPost, "/api/cart/items", bytes.NewBufferString(`{"productId":"kb-001","quantity":1}`))
	reqAdd.Header.Set("X-Session-ID", sess)
	recAdd := httptest.NewRecorder()
	router.ServeHTTP(recAdd, reqAdd)
	if recAdd.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on broken store addItem, got %d", recAdd.Code)
	}

	// POST /api/cart/items with upstream timeout -> 504
	reqTimeout := httptest.NewRequest(http.MethodPost, "/api/cart/items", bytes.NewBufferString(`{"productId":"timeout-prod","quantity":1}`))
	reqTimeout.Header.Set("X-Session-ID", sess)
	recTimeout := httptest.NewRecorder()
	router.ServeHTTP(recTimeout, reqTimeout)
	if recTimeout.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected 504 on catalog timeout, got %d", recTimeout.Code)
	}

	// PUT /api/cart/items/kb-001 with broken store -> 500
	reqPut := httptest.NewRequest(http.MethodPut, "/api/cart/items/kb-001", bytes.NewBufferString(`{"quantity":2}`))
	reqPut.Header.Set("X-Session-ID", sess)
	recPut := httptest.NewRecorder()
	router.ServeHTTP(recPut, reqPut)
	if recPut.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on broken store setItem, got %d", recPut.Code)
	}

	// PUT /api/cart/items/timeout-prod -> 504
	reqPutTimeout := httptest.NewRequest(http.MethodPut, "/api/cart/items/timeout-prod", bytes.NewBufferString(`{"quantity":2}`))
	reqPutTimeout.Header.Set("X-Session-ID", sess)
	recPutTimeout := httptest.NewRecorder()
	router.ServeHTTP(recPutTimeout, reqPutTimeout)
	if recPutTimeout.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected 504 on setItem catalog timeout, got %d", recPutTimeout.Code)
	}

	// DELETE /api/cart/items/kb-001 with broken store -> 500
	reqDel := httptest.NewRequest(http.MethodDelete, "/api/cart/items/kb-001", nil)
	reqDel.Header.Set("X-Session-ID", sess)
	recDel := httptest.NewRecorder()
	router.ServeHTTP(recDel, reqDel)
	if recDel.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on broken store removeItem, got %d", recDel.Code)
	}

	// DELETE /api/cart with broken store -> 500
	reqClear := httptest.NewRequest(http.MethodDelete, "/api/cart", nil)
	reqClear.Header.Set("X-Session-ID", sess)
	recClear := httptest.NewRecorder()
	router.ServeHTTP(recClear, reqClear)
	if recClear.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on broken store clearCart, got %d", recClear.Code)
	}
}

type stubCatalog struct {
	delegate internal.CatalogClient
}

func (s *stubCatalog) GetProduct(ctx context.Context, productID string) (internal.CatalogProduct, error) {
	if productID == "timeout-prod" {
		return internal.CatalogProduct{}, internal.ErrUpstreamTimeout
	}
	return s.delegate.GetProduct(ctx, productID)
}

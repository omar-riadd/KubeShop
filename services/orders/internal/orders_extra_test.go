package internal_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/kubeshop/kubeshop-platform/services/orders/internal"
)

func TestValidateOrderRequestEdgeCases(t *testing.T) {
	// Email validation edge cases
	emails := []string{
		"",
		strings.Repeat("a", 250) + "@b.com",
		"Display Name <user@example.com>",
		"user@localhost",
		"user@.example.com",
		"user@example.com.",
	}
	for _, em := range emails {
		req := internal.OrderRequest{
			Customer: internal.Customer{Name: "Valid", Email: em},
			ShippingAddress: internal.ShippingAddress{
				Line1:      "1 Main",
				Line2:      strings.Repeat("x", 201), // > 200 runes
				City:       "London",
				PostalCode: "N1 9GU",
				Country:    "GB",
			},
		}
		details := internal.ValidateOrderRequest(&req)
		if len(details) < 2 {
			t.Fatalf("expected email + line2 validation errors for %q, got %+v", em, details)
		}
	}
}

func TestHTTPCartClientAndHandlerErrorPaths(t *testing.T) {
	if c := internal.NewHTTPCartClient("http://localhost:9999/", nil); c == nil {
		t.Fatal("expected non-nil HTTPCartClient")
	}

	mode := "ok"
	cartSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch mode {
		case "bad-status":
			w.WriteHeader(http.StatusInternalServerError)
		case "bad-json":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("{invalid"))
		case "slow":
			time.Sleep(80 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		case "clear-fail":
			if r.Method == http.MethodDelete {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			platform.WriteJSON(w, http.StatusOK, internal.CartSnapshot{
				Items: []internal.CartItem{
					{ProductID: "kb-001", Name: "Keyboard", PriceCents: 1000, Quantity: 1, LineTotalCents: 1000},
				},
				ItemCount:     1,
				SubtotalCents: 1000,
				Currency:      "", // test currency fallback to USD in store.Create
			})
		}
	}))
	t.Cleanup(cartSrv.Close)

	cc := internal.NewHTTPCartClient(cartSrv.URL, cartSrv.Client())

	mode = "bad-status"
	if _, err := cc.GetCart(context.Background(), "s1"); !errors.Is(err, internal.ErrCartUpstreamUnavailable) {
		t.Fatalf("expected ErrCartUpstreamUnavailable on 500, got %v", err)
	}
	if err := cc.ClearCart(context.Background(), "s1"); err == nil {
		t.Fatal("expected error from ClearCart on 500")
	}

	mode = "bad-json"
	if _, err := cc.GetCart(context.Background(), "s1"); !errors.Is(err, internal.ErrCartUpstreamUnavailable) {
		t.Fatalf("expected ErrCartUpstreamUnavailable on bad json, got %v", err)
	}

	mode = "slow"
	shortCtx, cancel := context.WithTimeout(context.Background(), 15*time.Millisecond)
	defer cancel()
	if _, err := cc.GetCart(shortCtx, "s1"); !errors.Is(err, internal.ErrCartUpstreamTimeout) {
		t.Fatalf("expected ErrCartUpstreamTimeout on timeout, got %v", err)
	}

	// Handler error paths with live DB initially, then closed DB pool
	pool := startPostgresAndMigrate(t)
	store := internal.NewStore(pool)

	cfg := platform.Config{ServiceName: "orders", AppEnv: "local", AppVersion: "dev"}
	logger := platform.NewLogger(cfg, io.Discard)
	reg := platform.NewRegistry()
	router := platform.NewRouter(cfg, logger, nil)
	h := internal.NewHandler(store, cc, cfg, "", logger, reg)
	h.RegisterRoutes(router)

	sess := uuid.NewString()
	validBody := `{
		"customer": {"name": "Ada Lovelace", "email": "ada@example.com"},
		"shippingAddress": {"line1": "1 Analytical St", "line2": "", "city": "London", "postalCode": "N1 9GU", "country": "GB"}
	}`

	// 1. Invalid JSON body -> 400
	reqBadJSON := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString("{bad"))
	reqBadJSON.Header.Set("X-Session-ID", sess)
	recBadJSON := httptest.NewRecorder()
	router.ServeHTTP(recBadJSON, reqBadJSON)
	if recBadJSON.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on bad json, got %d", recBadJSON.Code)
	}

	// 2. Missing Idempotency-Key -> 400
	reqNoIdem := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(validBody))
	reqNoIdem.Header.Set("X-Session-ID", sess)
	recNoIdem := httptest.NewRecorder()
	router.ServeHTTP(recNoIdem, reqNoIdem)
	if recNoIdem.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on missing Idempotency-Key, got %d", recNoIdem.Code)
	}

	// 3. Cart upstream 500 -> 502
	mode = "bad-status"
	reqCart502 := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(validBody))
	reqCart502.Header.Set("X-Session-ID", sess)
	reqCart502.Header.Set("Idempotency-Key", uuid.NewString())
	recCart502 := httptest.NewRecorder()
	router.ServeHTTP(recCart502, reqCart502)
	if recCart502.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on cart 500, got %d", recCart502.Code)
	}

	// 4. ClearCart failure after Create still returns 201 (best-effort) + currency fallback "" -> "USD"
	mode = "clear-fail"
	idem := uuid.NewString()
	reqClearFail := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(validBody))
	reqClearFail.Header.Set("X-Session-ID", sess)
	reqClearFail.Header.Set("Idempotency-Key", idem)
	recClearFail := httptest.NewRecorder()
	router.ServeHTTP(recClearFail, reqClearFail)
	if recClearFail.Code != http.StatusCreated {
		t.Fatalf("expected 201 even when ClearCart fails, got %d", recClearFail.Code)
	}

	// 5. Direct Store.Create with duplicate (session_id, idempotency_key) exercises unique violation 23505 replay
	orderReq := internal.OrderRequest{
		Customer:        internal.Customer{Name: "Ada", Email: "ada@example.com"},
		ShippingAddress: internal.ShippingAddress{Line1: "1 Main", City: "London", PostalCode: "N1", Country: "GB"},
	}
	cartSnap := internal.CartSnapshot{
		Items: []internal.CartItem{{ProductID: "kb-001", Name: "KB", PriceCents: 1000, Quantity: 1}},
	}
	_, replayed, err := store.Create(context.Background(), sess, idem, orderReq, cartSnap)
	if err != nil || !replayed {
		t.Fatalf("expected replayed=true on duplicate 23505 key, got replayed=%v err=%v", replayed, err)
	}

	// 6. GET /api/orders/{id} with non-UUID -> 404
	reqNonUUID := httptest.NewRequest(http.MethodGet, "/api/orders/not-a-uuid", nil)
	reqNonUUID.Header.Set("X-Session-ID", sess)
	recNonUUID := httptest.NewRecorder()
	router.ServeHTTP(recNonUUID, reqNonUUID)
	if recNonUUID.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-UUID order id, got %d", recNonUUID.Code)
	}

	// 7. Close pool and verify 500 error branches in createOrder, listOrders, getOrder
	pool.Close()

	reqListErr := httptest.NewRequest(http.MethodGet, "/api/orders", nil)
	reqListErr.Header.Set("X-Session-ID", sess)
	recListErr := httptest.NewRecorder()
	router.ServeHTTP(recListErr, reqListErr)
	if recListErr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on closed pool listOrders, got %d", recListErr.Code)
	}

	reqGetErr := httptest.NewRequest(http.MethodGet, "/api/orders/"+uuid.NewString(), nil)
	reqGetErr.Header.Set("X-Session-ID", sess)
	recGetErr := httptest.NewRecorder()
	router.ServeHTTP(recGetErr, reqGetErr)
	if recGetErr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on closed pool getOrder, got %d", recGetErr.Code)
	}

	reqCreateErr := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(validBody))
	reqCreateErr.Header.Set("X-Session-ID", sess)
	reqCreateErr.Header.Set("Idempotency-Key", uuid.NewString())
	recCreateErr := httptest.NewRecorder()
	router.ServeHTTP(recCreateErr, reqCreateErr)
	if recCreateErr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on closed pool createOrder, got %d", recCreateErr.Code)
	}
}

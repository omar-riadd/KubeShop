package internal_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform/contracttest"
	"github.com/kubeshop/kubeshop-platform/services/orders/internal"
	"github.com/kubeshop/kubeshop-platform/services/orders/migrations"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func startPostgresAndMigrate(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()
	container, err := tcpostgres.Run(ctx,
		"postgres:17-alpine",
		tcpostgres.WithDatabase("kubeshop"),
		tcpostgres.WithUsername("kubeshop"),
		tcpostgres.WithPassword("kubeshop"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		_ = testcontainers.TerminateContainer(container)
	})

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("postgres conn string: %v", err)
	}

	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		t.Fatalf("iofs migrations: %v", err)
	}
	migrateDSN := "pgx5://" + strings.TrimPrefix(strings.TrimPrefix(connStr, "postgresql://"), "postgres://")
	m, err := migrate.NewWithSourceInstance("iofs", src, migrateDSN)
	if err != nil {
		t.Fatalf("init migrate: %v", err)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("migrate up: %v", err)
	}
	_, _ = m.Close()

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("pgxpool new: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestOrdersIntegrationAndContract(t *testing.T) {
	pool := startPostgresAndMigrate(t)

	cartEmpty := false
	clearCalled := 0
	cartSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if cartEmpty {
				platform.WriteJSON(w, http.StatusOK, internal.CartSnapshot{
					Items:         []internal.CartItem{},
					ItemCount:     0,
					SubtotalCents: 0,
					Currency:      "USD",
				})
				return
			}
			platform.WriteJSON(w, http.StatusOK, internal.CartSnapshot{
				Items: []internal.CartItem{
					{
						ProductID:      "kb-001",
						Name:           "Nimbus 75 Mechanical Keyboard",
						PriceCents:     8900,
						Quantity:       2,
						LineTotalCents: 17800,
					},
				},
				ItemCount:     2,
				SubtotalCents: 17800,
				Currency:      "USD",
			})
		case http.MethodDelete:
			clearCalled++
			platform.WriteJSON(w, http.StatusOK, internal.CartSnapshot{
				Items:    []internal.CartItem{},
				Currency: "USD",
			})
		}
	}))
	t.Cleanup(cartSrv.Close)

	cfg := platform.Config{
		ServiceName:  "orders",
		AppEnv:       "local",
		AppVersion:   "dev",
		AppGitSHA:    "local",
		AppBuildTime: "2026-11-20T09:58:00Z",
		PodName:      "orders-test",
	}
	logger := platform.NewLogger(cfg, io.Discard)
	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	router := platform.NewRouter(cfg, logger, metrics)

	store := internal.NewStore(pool)
	cartClient := internal.NewHTTPCartClient(cartSrv.URL, cartSrv.Client())
	h := internal.NewHandler(store, cartClient, cfg, logger, reg)
	h.RegisterRoutes(router)

	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	client := srv.Client()

	sessionID := uuid.NewString()
	otherSessionID := uuid.NewString()
	idemKey := uuid.NewString()

	validBody := `{
		"customer": {"name": "Ada Lovelace", "email": "ada@example.com"},
		"shippingAddress": {"line1": "1 Analytical St", "line2": "", "city": "London", "postalCode": "N1 9GU", "country": "GB"}
	}`

	// 1. Validation error (bad email + bad country) -> 400
	badBody := `{"customer":{"name":"","email":"not-an-email"},"shippingAddress":{"line1":"","city":"","postalCode":"","country":"uk"}}`
	reqBad, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/orders", bytes.NewBufferString(badBody))
	reqBad.Header.Set("X-Session-ID", sessionID)
	reqBad.Header.Set("Idempotency-Key", idemKey)
	reqBad.Header.Set("Content-Type", "application/json")
	respBad, err := client.Do(reqBad)
	if err != nil {
		t.Fatalf("POST invalid order: %v", err)
	}
	defer func() { _ = respBad.Body.Close() }()
	contracttest.AssertResponseValid(t, reqBad, respBad)
	if respBad.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", respBad.StatusCode)
	}

	// 2. Empty cart -> 422 CART_EMPTY
	cartEmpty = true
	reqEmpty, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/orders", bytes.NewBufferString(validBody))
	reqEmpty.Header.Set("X-Session-ID", sessionID)
	reqEmpty.Header.Set("Idempotency-Key", uuid.NewString())
	reqEmpty.Header.Set("Content-Type", "application/json")
	respEmpty, err := client.Do(reqEmpty)
	if err != nil {
		t.Fatalf("POST empty cart: %v", err)
	}
	defer func() { _ = respEmpty.Body.Close() }()
	contracttest.AssertResponseValid(t, reqEmpty, respEmpty)
	if respEmpty.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", respEmpty.StatusCode)
	}

	// 3. Create order -> 201
	cartEmpty = false
	reqCreate, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/orders", bytes.NewBufferString(validBody))
	reqCreate.Header.Set("X-Session-ID", sessionID)
	reqCreate.Header.Set("Idempotency-Key", idemKey)
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, err := client.Do(reqCreate)
	if err != nil {
		t.Fatalf("POST create order: %v", err)
	}
	defer func() { _ = respCreate.Body.Close() }()
	contracttest.AssertResponseValid(t, reqCreate, respCreate)
	if respCreate.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", respCreate.StatusCode)
	}
	var created internal.Order
	if err := json.NewDecoder(respCreate.Body).Decode(&created); err != nil {
		t.Fatalf("decode created order: %v", err)
	}
	if created.TotalCents != 17800 || created.Status != "PLACED" || clearCalled != 1 {
		t.Fatalf("unexpected created order=%+v clearCalled=%d", created, clearCalled)
	}

	// 4. Idempotent replay -> 200 with same order ID
	reqReplay, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/orders", bytes.NewBufferString(validBody))
	reqReplay.Header.Set("X-Session-ID", sessionID)
	reqReplay.Header.Set("Idempotency-Key", idemKey)
	reqReplay.Header.Set("Content-Type", "application/json")
	respReplay, err := client.Do(reqReplay)
	if err != nil {
		t.Fatalf("POST replay order: %v", err)
	}
	defer func() { _ = respReplay.Body.Close() }()
	contracttest.AssertResponseValid(t, reqReplay, respReplay)
	if respReplay.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on replay, got %d", respReplay.StatusCode)
	}
	var replayed internal.Order
	if err := json.NewDecoder(respReplay.Body).Decode(&replayed); err != nil {
		t.Fatalf("decode replayed order: %v", err)
	}
	if replayed.ID != created.ID {
		t.Fatalf("expected same order id %s, got %s", created.ID, replayed.ID)
	}

	// 5. GET /api/orders -> list contains created order
	reqList, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/orders", nil)
	reqList.Header.Set("X-Session-ID", sessionID)
	respList, err := client.Do(reqList)
	if err != nil {
		t.Fatalf("GET orders: %v", err)
	}
	defer func() { _ = respList.Body.Close() }()
	contracttest.AssertResponseValid(t, reqList, respList)
	if respList.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respList.StatusCode)
	}

	// 6. GET /api/orders/{id} -> 200 for owner, 404 for another session
	reqGet, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/orders/"+created.ID, nil)
	reqGet.Header.Set("X-Session-ID", sessionID)
	respGet, err := client.Do(reqGet)
	if err != nil {
		t.Fatalf("GET order by id: %v", err)
	}
	defer func() { _ = respGet.Body.Close() }()
	contracttest.AssertResponseValid(t, reqGet, respGet)
	if respGet.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respGet.StatusCode)
	}

	reqOther, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/orders/"+created.ID, nil)
	reqOther.Header.Set("X-Session-ID", otherSessionID)
	respOther, err := client.Do(reqOther)
	if err != nil {
		t.Fatalf("GET order other session: %v", err)
	}
	defer func() { _ = respOther.Body.Close() }()
	contracttest.AssertResponseValid(t, reqOther, respOther)
	if respOther.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for another session, got %d", respOther.StatusCode)
	}

	// 7. GET /api/orders/version
	reqVer, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/orders/version", nil)
	respVer, err := client.Do(reqVer)
	if err != nil {
		t.Fatalf("GET version: %v", err)
	}
	defer func() { _ = respVer.Body.Close() }()
	contracttest.AssertResponseValid(t, reqVer, respVer)
	if respVer.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respVer.StatusCode)
	}
}

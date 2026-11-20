package internal_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kubeshop/kubeshop-platform/services/catalog/internal"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform/contracttest"
)

func newCatalogTestServer(t *testing.T, faultRate float64) *httptest.Server {
	t.Helper()
	store, err := internal.NewStore()
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	cfg := platform.Config{
		ServiceName:    "catalog",
		AppEnv:         "local",
		AppVersion:     "dev",
		AppGitSHA:      "local",
		AppBuildTime:   "2026-11-20T09:58:00Z",
		PodName:        "catalog-test",
		FaultErrorRate: faultRate,
	}
	logger := platform.NewLogger(cfg, io.Discard)
	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	router := platform.NewRouter(cfg, logger, metrics)

	h := internal.NewHandler(store, cfg)
	h.RegisterRoutes(router)

	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	return srv
}

func TestCatalogEndpointsAndContract(t *testing.T) {
	srv := newCatalogTestServer(t, 0)
	client := srv.Client()

	// 1. List all products (12 seed items sorted by id asc)
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/products", nil)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET /api/catalog/products: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	contracttest.AssertResponseValid(t, req, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var list struct {
		Items []internal.Product `json:"items"`
		Total int                `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if list.Total != 12 || len(list.Items) != 12 {
		t.Fatalf("expected 12 products, got total=%d len=%d", list.Total, len(list.Items))
	}
	if list.Items[0].ID != "ac-001" {
		t.Fatalf("expected ascending id sort starting at ac-001, got %s", list.Items[0].ID)
	}

	// 2. Category + search + pagination
	req2, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/products?category=keyboards&q=wireless&limit=1&offset=0", nil)
	resp2, err := client.Do(req2)
	if err != nil {
		t.Fatalf("GET filtered: %v", err)
	}
	defer func() { _ = resp2.Body.Close() }()
	contracttest.AssertResponseValid(t, req2, resp2)
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	var filtered struct {
		Items []internal.Product `json:"items"`
		Total int                `json:"total"`
	}
	if err := json.NewDecoder(resp2.Body).Decode(&filtered); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if filtered.Total != 1 || len(filtered.Items) != 1 || filtered.Items[0].ID != "kb-002" {
		t.Fatalf("unexpected filtered result: %+v", filtered)
	}

	// 3. Invalid query params -> 400 VALIDATION_ERROR
	reqBad, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/products?limit=999", nil)
	respBad, err := client.Do(reqBad)
	if err != nil {
		t.Fatalf("GET bad limit: %v", err)
	}
	defer func() { _ = respBad.Body.Close() }()
	contracttest.AssertResponseValid(t, reqBad, respBad)
	if respBad.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", respBad.StatusCode)
	}

	// 4. Get single product
	reqGet, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/products/kb-001", nil)
	respGet, err := client.Do(reqGet)
	if err != nil {
		t.Fatalf("GET kb-001: %v", err)
	}
	defer func() { _ = respGet.Body.Close() }()
	contracttest.AssertResponseValid(t, reqGet, respGet)
	if respGet.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respGet.StatusCode)
	}

	// 5. Missing product -> 404 PRODUCT_NOT_FOUND
	req404, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/products/zz-999", nil)
	resp404, err := client.Do(req404)
	if err != nil {
		t.Fatalf("GET zz-999: %v", err)
	}
	defer func() { _ = resp404.Body.Close() }()
	contracttest.AssertResponseValid(t, req404, resp404)
	if resp404.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp404.StatusCode)
	}

	// 6. Categories
	reqCat, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/categories", nil)
	respCat, err := client.Do(reqCat)
	if err != nil {
		t.Fatalf("GET categories: %v", err)
	}
	defer func() { _ = respCat.Body.Close() }()
	contracttest.AssertResponseValid(t, reqCat, respCat)
	if respCat.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respCat.StatusCode)
	}

	// 7. Version
	reqVer, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/version", nil)
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

func TestCatalogFaultInjection(t *testing.T) {
	srv := newCatalogTestServer(t, 1.0)
	client := srv.Client()

	// /api/catalog/products must fail with 500 FAULT_INJECTED
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/products", nil)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET products under fault: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	contracttest.AssertResponseValid(t, req, resp)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.StatusCode)
	}

	// /api/catalog/version must remain healthy
	reqVer, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/catalog/version", nil)
	respVer, err := client.Do(reqVer)
	if err != nil {
		t.Fatalf("GET version under fault: %v", err)
	}
	defer func() { _ = respVer.Body.Close() }()
	contracttest.AssertResponseValid(t, reqVer, respVer)
	if respVer.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /version, got %d", respVer.StatusCode)
	}
}

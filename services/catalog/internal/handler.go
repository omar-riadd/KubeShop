package internal

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

const (
	defaultLimit = 50
	maxLimit     = 100
)

// Handler serves the catalog HTTP endpoints.
type Handler struct {
	store *Store
	cfg   platform.Config
}

// NewHandler creates a catalog Handler.
func NewHandler(store *Store, cfg platform.Config) *Handler {
	return &Handler{store: store, cfg: cfg}
}

// RegisterRoutes mounts all catalog endpoints on the provided chi router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/catalog/products", h.listProducts)
	r.Get("/api/catalog/products/{id}", h.getProduct)
	r.Get("/api/catalog/categories", h.listCategories)
	r.Get("/api/catalog/version", platform.VersionHandler(h.cfg))
}

type productListResponse struct {
	Items []Product `json:"items"`
	Total int       `json:"total"`
}

type categoryListResponse struct {
	Items []Category `json:"items"`
}

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	category := strings.TrimSpace(q.Get("category"))
	search := q.Get("q")

	var details []platform.ErrorDetail

	if category != "" && !isValidCategory(category) {
		details = append(details, platform.ErrorDetail{
			Field:   "category",
			Message: "must be one of keyboards, mice, audio, accessories",
		})
	}

	limit := defaultLimit
	if raw := strings.TrimSpace(q.Get("limit")); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 1 || v > maxLimit {
			details = append(details, platform.ErrorDetail{
				Field:   "limit",
				Message: "must be an integer between 1 and 100",
			})
		} else {
			limit = v
		}
	}

	offset := 0
	if raw := strings.TrimSpace(q.Get("offset")); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 0 {
			details = append(details, platform.ErrorDetail{
				Field:   "offset",
				Message: "must be an integer >= 0",
			})
		} else {
			offset = v
		}
	}

	if len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	items, total := h.store.List(category, search, limit, offset)
	platform.WriteJSON(w, http.StatusOK, productListResponse{
		Items: items,
		Total: total,
	})
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	product, ok := h.store.Get(id)
	if !ok {
		platform.WriteError(w, r, http.StatusNotFound, platform.CodeProductNotFound, "Product not found")
		return
	}
	platform.WriteJSON(w, http.StatusOK, product)
}

func (h *Handler) listCategories(w http.ResponseWriter, _ *http.Request) {
	platform.WriteJSON(w, http.StatusOK, categoryListResponse{
		Items: h.store.Categories(),
	})
}

func isValidCategory(c string) bool {
	switch c {
	case "keyboards", "mice", "audio", "accessories":
		return true
	default:
		return false
	}
}

package internal

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/prometheus/client_golang/prometheus"
)

// Handler serves the cart HTTP endpoints.
type Handler struct {
	store      *Store
	catalog    CatalogClient
	cfg        platform.Config
	logger     *slog.Logger
	itemsAdded prometheus.Counter
}

// NewHandler creates a cart Handler and registers cart-specific metrics.
func NewHandler(store *Store, catalog CatalogClient, cfg platform.Config, logger *slog.Logger, reg prometheus.Registerer) *Handler {
	counter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "cart_items_added_total",
		Help: "Total number of item units added to carts.",
	})
	if reg != nil {
		reg.MustRegister(counter)
	}
	return &Handler{
		store:      store,
		catalog:    catalog,
		cfg:        cfg,
		logger:     logger,
		itemsAdded: counter,
	}
}

// RegisterRoutes mounts all cart endpoints on the chi router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/cart/version", platform.VersionHandler(h.cfg))

	r.Group(func(sr chi.Router) {
		sr.Use(platform.RequireSession)
		sr.Get("/api/cart", h.getCart)
		sr.Delete("/api/cart", h.clearCart)
		sr.Post("/api/cart/items", h.addItem)
		sr.Put("/api/cart/items/{productId}", h.setItem)
		sr.Delete("/api/cart/items/{productId}", h.removeItem)
	})
}

type addItemRequest struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

type setItemRequest struct {
	Quantity int `json:"quantity"`
}

func (h *Handler) getCart(w http.ResponseWriter, r *http.Request) {
	sessionID := platform.SessionIDFromContext(r.Context())
	cart, err := h.store.Get(r.Context(), sessionID)
	if err != nil {
		h.logger.Error("failed to get cart", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to read cart")
		return
	}
	platform.WriteJSON(w, http.StatusOK, cart)
}

func (h *Handler) addItem(w http.ResponseWriter, r *http.Request) {
	var req addItemRequest
	if details := platform.DecodeJSON(r, &req); len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	var details []platform.ErrorDetail
	req.ProductID = strings.TrimSpace(req.ProductID)
	if req.ProductID == "" {
		details = append(details, platform.ErrorDetail{Field: "productId", Message: "productId is required"})
	}
	if req.Quantity < minQuantity || req.Quantity > maxQuantity {
		details = append(details, platform.ErrorDetail{Field: "quantity", Message: "must be an integer between 1 and 20"})
	}
	if len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	product, err := h.catalog.GetProduct(r.Context(), req.ProductID)
	if err != nil {
		h.writeCatalogError(w, r, err)
		return
	}

	sessionID := platform.SessionIDFromContext(r.Context())
	cart, err := h.store.AddItem(r.Context(), sessionID, product, req.Quantity)
	if err != nil {
		if errors.Is(err, ErrQuantityOutOfRange) {
			platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed",
				platform.ErrorDetail{Field: "quantity", Message: "line quantity cannot exceed 20"})
			return
		}
		h.logger.Error("failed to add cart item", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to update cart")
		return
	}

	h.itemsAdded.Add(float64(req.Quantity))
	platform.WriteJSON(w, http.StatusOK, cart)
}

func (h *Handler) setItem(w http.ResponseWriter, r *http.Request) {
	productID := strings.TrimSpace(chi.URLParam(r, "productId"))
	var req setItemRequest
	if details := platform.DecodeJSON(r, &req); len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	if req.Quantity < minQuantity || req.Quantity > maxQuantity {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed",
			platform.ErrorDetail{Field: "quantity", Message: "must be an integer between 1 and 20"})
		return
	}

	product, err := h.catalog.GetProduct(r.Context(), productID)
	if err != nil {
		h.writeCatalogError(w, r, err)
		return
	}

	sessionID := platform.SessionIDFromContext(r.Context())
	cart, err := h.store.SetItem(r.Context(), sessionID, product, req.Quantity)
	if err != nil {
		h.logger.Error("failed to set cart item", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to update cart")
		return
	}

	platform.WriteJSON(w, http.StatusOK, cart)
}

func (h *Handler) removeItem(w http.ResponseWriter, r *http.Request) {
	productID := strings.TrimSpace(chi.URLParam(r, "productId"))
	sessionID := platform.SessionIDFromContext(r.Context())

	cart, err := h.store.RemoveItem(r.Context(), sessionID, productID)
	if err != nil {
		h.logger.Error("failed to remove cart item", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to update cart")
		return
	}
	platform.WriteJSON(w, http.StatusOK, cart)
}

func (h *Handler) clearCart(w http.ResponseWriter, r *http.Request) {
	sessionID := platform.SessionIDFromContext(r.Context())
	cart, err := h.store.Clear(r.Context(), sessionID)
	if err != nil {
		h.logger.Error("failed to clear cart", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to clear cart")
		return
	}
	platform.WriteJSON(w, http.StatusOK, cart)
}

func (h *Handler) writeCatalogError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrProductNotFound):
		platform.WriteError(w, r, http.StatusNotFound, platform.CodeProductNotFound, "Product not found")
	case errors.Is(err, ErrUpstreamTimeout):
		platform.WriteError(w, r, http.StatusGatewayTimeout, platform.CodeUpstreamTimeout, "Catalog service timed out")
	default:
		platform.WriteError(w, r, http.StatusBadGateway, platform.CodeUpstreamUnavailable, "Catalog service unavailable")
	}
}

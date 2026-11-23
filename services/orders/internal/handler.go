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

// Handler serves the orders HTTP endpoints.
type Handler struct {
	store         *Store
	cart          CartClient
	cfg           platform.Config
	logger        *slog.Logger
	ordersCreated prometheus.Counter
	orderValue    prometheus.Histogram
	rateLimiter   func(http.Handler) http.Handler
}

// NewHandler creates an orders Handler and registers orders-specific metrics.
func NewHandler(store *Store, cart CartClient, cfg platform.Config, logger *slog.Logger, reg prometheus.Registerer) *Handler {
	created := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "orders_created_total",
		Help: "Total number of orders placed.",
	})
	value := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "order_value_cents",
		Help:    "Distribution of order totals in minor currency units (cents).",
		Buckets: []float64{2000, 5000, 10000, 20000, 50000, 100000, 250000},
	})
	if reg != nil {
		reg.MustRegister(created, value)
	}
	return &Handler{
		store:         store,
		cart:          cart,
		cfg:           cfg,
		logger:        logger,
		ordersCreated: created,
		orderValue:    value,
		rateLimiter:   platform.SessionRateLimitMiddleware(2, 5),
	}
}

// SetRateLimiter overrides the rate limiter middleware on POST /api/orders (useful in tests).
func (h *Handler) SetRateLimiter(mw func(http.Handler) http.Handler) {
	h.rateLimiter = mw
}

// RegisterRoutes mounts all orders endpoints on the chi router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/orders/version", platform.VersionHandler(h.cfg))

	r.Group(func(sr chi.Router) {
		sr.Use(platform.RequireSession)
		if h.rateLimiter != nil {
			sr.With(h.rateLimiter).Post("/api/orders", h.createOrder)
		} else {
			sr.Post("/api/orders", h.createOrder)
		}
		sr.Get("/api/orders", h.listOrders)
		sr.Get("/api/orders/{id}", h.getOrder)
		sr.Patch("/api/orders/{id}/status", h.updateOrderStatus)
	})
}

type orderListResponse struct {
	Items []Order `json:"items"`
}

type updateOrderStatusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	var req OrderRequest
	if details := platform.DecodeJSON(r, &req); len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	details := ValidateOrderRequest(&req)

	idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idemKey == "" || !platform.IsUUID(idemKey) {
		details = append(details, platform.ErrorDetail{
			Field:   "Idempotency-Key",
			Message: "header is required and must be a valid UUID",
		})
	}

	if len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	sessionID := platform.SessionIDFromContext(r.Context())

	existing, found, err := h.store.FindByIdempotencyKey(r.Context(), sessionID, idemKey)
	if err != nil {
		h.logger.Error("failed idempotency lookup", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to process order")
		return
	}
	if found {
		platform.WriteJSON(w, http.StatusOK, existing)
		return
	}

	cart, err := h.cart.GetCart(r.Context(), sessionID)
	if err != nil {
		if errors.Is(err, ErrCartUpstreamTimeout) {
			platform.WriteError(w, r, http.StatusGatewayTimeout, platform.CodeUpstreamTimeout, "Cart service timed out")
			return
		}
		platform.WriteError(w, r, http.StatusBadGateway, platform.CodeUpstreamUnavailable, "Cart service unavailable")
		return
	}

	if len(cart.Items) == 0 {
		platform.WriteError(w, r, http.StatusUnprocessableEntity, platform.CodeCartEmpty, "Cart is empty")
		return
	}

	order, replayed, err := h.store.Create(r.Context(), sessionID, idemKey, req, cart)
	if err != nil {
		h.logger.Error("failed to create order", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to create order")
		return
	}
	if replayed {
		platform.WriteJSON(w, http.StatusOK, order)
		return
	}

	h.ordersCreated.Inc()
	h.orderValue.Observe(float64(order.TotalCents))

	if err := h.cart.ClearCart(r.Context(), sessionID); err != nil {
		h.logger.Warn("best-effort cart clear failed after order creation",
			slog.String("requestId", platform.RequestIDFromContext(r.Context())),
			slog.String("orderId", order.ID),
			slog.String("error", err.Error()),
		)
	}

	platform.WriteJSON(w, http.StatusCreated, order)
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	sessionID := platform.SessionIDFromContext(r.Context())
	orders, err := h.store.List(r.Context(), sessionID)
	if err != nil {
		h.logger.Error("failed to list orders", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to list orders")
		return
	}
	platform.WriteJSON(w, http.StatusOK, orderListResponse{Items: orders})
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	orderID := strings.TrimSpace(chi.URLParam(r, "id"))
	if !platform.IsUUID(orderID) {
		platform.WriteError(w, r, http.StatusNotFound, platform.CodeOrderNotFound, "Order not found")
		return
	}

	sessionID := platform.SessionIDFromContext(r.Context())
	order, err := h.store.Get(r.Context(), sessionID, orderID)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			platform.WriteError(w, r, http.StatusNotFound, platform.CodeOrderNotFound, "Order not found")
			return
		}
		h.logger.Error("failed to get order", slog.String("requestId", platform.RequestIDFromContext(r.Context())), slog.String("error", err.Error()))
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to read order")
		return
	}
	platform.WriteJSON(w, http.StatusOK, order)
}

func (h *Handler) updateOrderStatus(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(r.Header.Get("Authorization")) == "" {
		platform.WriteError(w, r, http.StatusUnauthorized, platform.CodeUnauthorized, "Authorization header is required")
		return
	}

	orderID := strings.TrimSpace(chi.URLParam(r, "id"))
	if !platform.IsUUID(orderID) {
		platform.WriteError(w, r, http.StatusNotFound, platform.CodeOrderNotFound, "Order not found")
		return
	}

	var req updateOrderStatusRequest
	if details := platform.DecodeJSON(r, &req); len(details) > 0 {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", details...)
		return
	}

	req.Status = strings.TrimSpace(req.Status)
	if !IsValidTargetStatus(req.Status) {
		platform.WriteError(w, r, http.StatusBadRequest, platform.CodeValidationError, "Request validation failed", platform.ErrorDetail{
			Field:   "status",
			Message: "must be one of CONFIRMED, SHIPPED, DELIVERED, CANCELLED",
		})
		return
	}

	sessionID := platform.SessionIDFromContext(r.Context())
	order, err := h.store.UpdateStatus(r.Context(), sessionID, orderID, req.Status)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			platform.WriteError(w, r, http.StatusNotFound, platform.CodeOrderNotFound, "Order not found")
			return
		}
		if errors.Is(err, ErrInvalidTransition) {
			platform.WriteError(w, r, http.StatusConflict, platform.CodeInvalidTransition, "Order status transition is not allowed")
			return
		}
		h.logger.Error("failed to update order status",
			slog.String("requestId", platform.RequestIDFromContext(r.Context())),
			slog.String("orderId", orderID),
			slog.String("error", err.Error()),
		)
		platform.WriteError(w, r, http.StatusInternalServerError, platform.CodeInternalError, "Failed to update order status")
		return
	}

	h.logger.Info("order status updated",
		slog.String("requestId", platform.RequestIDFromContext(r.Context())),
		slog.String("orderId", order.ID),
		slog.String("status", order.Status),
	)
	platform.WriteJSON(w, http.StatusOK, order)
}

package internal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrOrderNotFound is returned when an order does not exist or belongs to another session.
var ErrOrderNotFound = errors.New("order not found")

// ErrInvalidTransition is returned when an order status transition is not permitted by the lifecycle state machine.
var ErrInvalidTransition = errors.New("invalid order status transition")

// Order lifecycle statuses.
const (
	StatusPlaced    = "PLACED"
	StatusConfirmed = "CONFIRMED"
	StatusShipped   = "SHIPPED"
	StatusDelivered = "DELIVERED"
	StatusCancelled = "CANCELLED"
)

// allowedPrevStatuses defines the legal state machine transitions:
//
//	PLACED -> CONFIRMED
//	CONFIRMED -> SHIPPED
//	SHIPPED -> DELIVERED
//	PLACED | CONFIRMED -> CANCELLED
//	DELIVERED | CANCELLED -> (terminal)
var allowedPrevStatuses = map[string][]string{
	StatusConfirmed: {StatusPlaced},
	StatusShipped:   {StatusConfirmed},
	StatusDelivered: {StatusShipped},
	StatusCancelled: {StatusPlaced, StatusConfirmed},
}

// IsValidTargetStatus reports whether status is a valid target for UpdateStatus.
func IsValidTargetStatus(status string) bool {
	_, ok := allowedPrevStatuses[status]
	return ok
}

// OrderItem matches Shared Contract §1.7 OrderItem schema.
type OrderItem struct {
	ProductID      string `json:"productId"`
	Name           string `json:"name"`
	PriceCents     int    `json:"priceCents"`
	Quantity       int    `json:"quantity"`
	LineTotalCents int    `json:"lineTotalCents"`
}

// Order matches Shared Contract §1.7 Order schema.
type Order struct {
	ID              string          `json:"id"`
	Status          string          `json:"status"`
	Items           []OrderItem     `json:"items"`
	TotalCents      int64           `json:"totalCents"`
	Currency        string          `json:"currency"`
	Customer        Customer        `json:"customer"`
	ShippingAddress ShippingAddress `json:"shippingAddress"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt,omitempty"`
}

// Store persists orders and order items in PostgreSQL.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore wraps a pgxpool.Pool.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Ping verifies database connectivity.
func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// FindByIdempotencyKey looks up an existing order for (sessionID, idempotencyKey).
func (s *Store) FindByIdempotencyKey(ctx context.Context, sessionID, idempotencyKey string) (Order, bool, error) {
	if idempotencyKey == "" {
		return Order{}, false, nil
	}
	row := s.pool.QueryRow(ctx, `
		SELECT id, status, customer_name, customer_email,
		       ship_line1, ship_line2, ship_city, ship_postal_code, ship_country,
		       currency, total_cents, created_at, updated_at
		FROM orders
		WHERE session_id = $1 AND idempotency_key = $2
	`, sessionID, idempotencyKey)

	order, err := scanOrder(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, false, nil
		}
		return Order{}, false, fmt.Errorf("find order by idempotency key: %w", err)
	}

	items, err := s.loadOrderItems(ctx, order.ID)
	if err != nil {
		return Order{}, false, err
	}
	order.Items = items
	return order, true, nil
}

// Create inserts an order and its line items in a single PostgreSQL transaction.
// If a concurrent request inserts the same (session_id, idempotency_key), it returns the existing order with replayed=true.
func (s *Store) Create(ctx context.Context, sessionID, idempotencyKey string, req OrderRequest, cart CartSnapshot) (Order, bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Order{}, false, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	orderID := uuid.NewString()
	now := time.Now().UTC().Truncate(time.Second)

	currency := cart.Currency
	if currency == "" {
		currency = "USD"
	}

	var totalCents int64
	items := make([]OrderItem, 0, len(cart.Items))
	for _, ci := range cart.Items {
		lineTotal := ci.PriceCents * ci.Quantity
		totalCents += int64(lineTotal)
		items = append(items, OrderItem{
			ProductID:      ci.ProductID,
			Name:           ci.Name,
			PriceCents:     ci.PriceCents,
			Quantity:       ci.Quantity,
			LineTotalCents: lineTotal,
		})
	}

	var idemParam any
	if idempotencyKey != "" {
		idemParam = idempotencyKey
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO orders (
			id, session_id, idempotency_key, status,
			customer_name, customer_email,
			ship_line1, ship_line2, ship_city, ship_postal_code, ship_country,
			currency, total_cents, created_at, updated_at
		) VALUES ($1, $2, $3, 'PLACED', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
	`,
		orderID, sessionID, idemParam,
		req.Customer.Name, req.Customer.Email,
		req.ShippingAddress.Line1, req.ShippingAddress.Line2,
		req.ShippingAddress.City, req.ShippingAddress.PostalCode, req.ShippingAddress.Country,
		currency, totalCents, now,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && idempotencyKey != "" {
			_ = tx.Rollback(ctx)
			existing, found, findErr := s.FindByIdempotencyKey(ctx, sessionID, idempotencyKey)
			if findErr != nil {
				return Order{}, false, findErr
			}
			if found {
				return existing, true, nil
			}
		}
		return Order{}, false, fmt.Errorf("insert order: %w", err)
	}

	for _, it := range items {
		_, err = tx.Exec(ctx, `
			INSERT INTO order_items (order_id, product_id, name, price_cents, quantity)
			VALUES ($1, $2, $3, $4, $5)
		`, orderID, it.ProductID, it.Name, it.PriceCents, it.Quantity)
		if err != nil {
			return Order{}, false, fmt.Errorf("insert order item %s: %w", it.ProductID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, false, fmt.Errorf("commit order tx: %w", err)
	}

	return Order{
		ID:              orderID,
		Status:          StatusPlaced,
		Items:           items,
		TotalCents:      totalCents,
		Currency:        currency,
		Customer:        req.Customer,
		ShippingAddress: req.ShippingAddress,
		CreatedAt:       now.Format(time.RFC3339),
		UpdatedAt:       now.Format(time.RFC3339),
	}, false, nil
}

// Get fetches a single order scoped to sessionID.
func (s *Store) Get(ctx context.Context, sessionID, orderID string) (Order, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, status, customer_name, customer_email,
		       ship_line1, ship_line2, ship_city, ship_postal_code, ship_country,
		       currency, total_cents, created_at, updated_at
		FROM orders
		WHERE id = $1 AND session_id = $2
	`, orderID, sessionID)

	order, err := scanOrder(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, ErrOrderNotFound
		}
		return Order{}, fmt.Errorf("get order: %w", err)
	}

	items, err := s.loadOrderItems(ctx, order.ID)
	if err != nil {
		return Order{}, err
	}
	order.Items = items
	return order, nil
}

// UpdateStatus transitions an order's status atomically using optimistic locking
// against allowedPrevStatuses. Returns ErrOrderNotFound if the order does not exist
// for sessionID, or ErrInvalidTransition if the current status cannot transition to newStatus.
func (s *Store) UpdateStatus(ctx context.Context, sessionID, orderID, newStatus string) (Order, error) {
	allowedPrev, ok := allowedPrevStatuses[newStatus]
	if !ok {
		return Order{}, ErrInvalidTransition
	}

	row := s.pool.QueryRow(ctx, `
		UPDATE orders
		SET status = $1, updated_at = NOW()
		WHERE id = $2 AND session_id = $3 AND status = ANY($4)
		RETURNING id, status, customer_name, customer_email,
		          ship_line1, ship_line2, ship_city, ship_postal_code, ship_country,
		          currency, total_cents, created_at, updated_at
	`, newStatus, orderID, sessionID, allowedPrev)

	order, err := scanOrder(row)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return Order{}, fmt.Errorf("update order status: %w", err)
		}
		var exists bool
		checkErr := s.pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND session_id = $2)`,
			orderID, sessionID,
		).Scan(&exists)
		if checkErr != nil {
			return Order{}, fmt.Errorf("check order exists: %w", checkErr)
		}
		if !exists {
			return Order{}, ErrOrderNotFound
		}
		return Order{}, ErrInvalidTransition
	}

	items, err := s.loadOrderItems(ctx, order.ID)
	if err != nil {
		return Order{}, err
	}
	order.Items = items
	return order, nil
}

// List returns up to 50 orders for sessionID, newest first.
func (s *Store) List(ctx context.Context, sessionID string) ([]Order, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, status, customer_name, customer_email,
		       ship_line1, ship_line2, ship_city, ship_postal_code, ship_country,
		       currency, total_cents, created_at, updated_at
		FROM orders
		WHERE session_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list orders: %w", err)
	}
	defer rows.Close()

	orders := make([]Order, 0)
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return nil, fmt.Errorf("scan order: %w", err)
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate orders: %w", err)
	}

	// Batch-load items for all orders in a single query (fixes N+1).
	if len(orders) > 0 {
		ids := make([]string, len(orders))
		for i, o := range orders {
			ids[i] = o.ID
		}
		itemsByOrder, err := s.loadOrderItemsBatch(ctx, ids)
		if err != nil {
			return nil, err
		}
		for i := range orders {
			orders[i].Items = itemsByOrder[orders[i].ID]
			if orders[i].Items == nil {
				orders[i].Items = []OrderItem{}
			}
		}
	}
	return orders, nil
}

// loadOrderItemsBatch fetches order items for multiple orders in one query.
// Returns a map keyed by order ID; orders with no items are absent from the map.
func (s *Store) loadOrderItemsBatch(ctx context.Context, orderIDs []string) (map[string][]OrderItem, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT order_id, product_id, name, price_cents, quantity
		FROM order_items
		WHERE order_id = ANY($1)
		ORDER BY order_id, product_id ASC
	`, orderIDs)
	if err != nil {
		return nil, fmt.Errorf("batch load order items: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]OrderItem, len(orderIDs))
	for rows.Next() {
		var (
			orderID string
			it      OrderItem
		)
		if err := rows.Scan(&orderID, &it.ProductID, &it.Name, &it.PriceCents, &it.Quantity); err != nil {
			return nil, fmt.Errorf("scan batch order item: %w", err)
		}
		it.LineTotalCents = it.PriceCents * it.Quantity
		result[orderID] = append(result[orderID], it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate batch order items: %w", err)
	}
	return result, nil
}

func (s *Store) loadOrderItems(ctx context.Context, orderID string) ([]OrderItem, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT product_id, name, price_cents, quantity
		FROM order_items
		WHERE order_id = $1
		ORDER BY product_id ASC
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("load order items: %w", err)
	}
	defer rows.Close()

	items := make([]OrderItem, 0)
	for rows.Next() {
		var it OrderItem
		if err := rows.Scan(&it.ProductID, &it.Name, &it.PriceCents, &it.Quantity); err != nil {
			return nil, fmt.Errorf("scan order item: %w", err)
		}
		it.LineTotalCents = it.PriceCents * it.Quantity
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate order items: %w", err)
	}
	return items, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanOrder(r rowScanner) (Order, error) {
	var (
		o         Order
		createdAt time.Time
		updatedAt time.Time
	)
	err := r.Scan(
		&o.ID, &o.Status,
		&o.Customer.Name, &o.Customer.Email,
		&o.ShippingAddress.Line1, &o.ShippingAddress.Line2,
		&o.ShippingAddress.City, &o.ShippingAddress.PostalCode, &o.ShippingAddress.Country,
		&o.Currency, &o.TotalCents, &createdAt, &updatedAt,
	)
	if err != nil {
		return Order{}, err
	}
	o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return o, nil
}

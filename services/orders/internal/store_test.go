package internal_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/kubeshop/kubeshop-platform/services/orders/internal"
)

// TestListBatchLoad verifies that Store.List returns all order items for
// multiple orders using the batch ANY($1) query (N+1 fix for F05).
func TestListBatchLoad(t *testing.T) {
	pool := startPostgresAndMigrate(t)
	store := internal.NewStore(pool)
	ctx := context.Background()

	sessionID := uuid.NewString()

	// Helper: create a minimal order via the store's Create method.
	makeOrder := func(productID, name string) internal.Order {
		cart := internal.CartSnapshot{
			Items: []internal.CartItem{
				{
					ProductID:      productID,
					Name:           name,
					PriceCents:     1000,
					Quantity:       3,
					LineTotalCents: 3000,
				},
			},
			ItemCount:     3,
			SubtotalCents: 3000,
			Currency:      "USD",
		}
		req := internal.OrderRequest{
			Customer: internal.Customer{
				Name:  "Test User",
				Email: "test@example.com",
			},
			ShippingAddress: internal.ShippingAddress{
				Line1:      "1 Test St",
				City:       "Testville",
				PostalCode: "12345",
				Country:    "US",
			},
		}
		order, _, err := store.Create(ctx, sessionID, uuid.NewString(), req, cart)
		if err != nil {
			t.Fatalf("create order: %v", err)
		}
		return order
	}

	o1 := makeOrder("prod-aaa", "Alpha Widget")
	o2 := makeOrder("prod-bbb", "Beta Gadget")
	o3 := makeOrder("prod-ccc", "Gamma Doohickey")

	orders, err := store.List(ctx, sessionID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	if len(orders) != 3 {
		t.Fatalf("expected 3 orders, got %d", len(orders))
	}

	// Build a lookup by ID for order-independent assertion.
	byID := make(map[string]internal.Order, len(orders))
	for _, o := range orders {
		byID[o.ID] = o
	}

	for _, want := range []internal.Order{o1, o2, o3} {
		got, ok := byID[want.ID]
		if !ok {
			t.Fatalf("order %s not found in List result", want.ID)
		}
		if len(got.Items) != 1 {
			t.Fatalf("order %s: expected 1 item, got %d", want.ID, len(got.Items))
		}
		if got.Items[0].ProductID != want.Items[0].ProductID {
			t.Fatalf("order %s: expected productID %s, got %s",
				want.ID, want.Items[0].ProductID, got.Items[0].ProductID)
		}
		if got.Items[0].LineTotalCents != 3000 {
			t.Fatalf("order %s: expected lineTotalCents 3000, got %d",
				want.ID, got.Items[0].LineTotalCents)
		}
	}
}

// TestListEmpty verifies that List returns an empty slice (not nil) when
// there are no orders for a session, skipping the batch query gracefully.
func TestListEmpty(t *testing.T) {
	pool := startPostgresAndMigrate(t)
	store := internal.NewStore(pool)
	ctx := context.Background()

	if err := store.Ping(ctx); err != nil {
		t.Fatalf("Ping: %v", err)
	}
	if _, found, err := store.FindByIdempotencyKey(ctx, uuid.NewString(), ""); err != nil || found {
		t.Fatalf("expected empty idempotency key to return found=false, got found=%v err=%v", found, err)
	}

	orders, err := store.List(ctx, uuid.NewString())
	if err != nil {
		t.Fatalf("List empty: %v", err)
	}
	if orders == nil {
		t.Fatal("expected non-nil empty slice, got nil")
	}
	if len(orders) != 0 {
		t.Fatalf("expected 0 orders, got %d", len(orders))
	}
}

// TestUpdateStatusTransitions verifies the DB-enforced order status state machine:
// PLACED -> CONFIRMED -> SHIPPED -> DELIVERED, PLACED|CONFIRMED -> CANCELLED,
// terminal rejection on DELIVERED/CANCELLED, skip-step rejection, and ErrOrderNotFound.
func TestUpdateStatusTransitions(t *testing.T) {
	pool := startPostgresAndMigrate(t)
	store := internal.NewStore(pool)
	ctx := context.Background()
	sessionID := uuid.NewString()
	otherSessionID := uuid.NewString()

	newOrder := func() internal.Order {
		t.Helper()
		cart := internal.CartSnapshot{
			Items: []internal.CartItem{
				{ProductID: "kb-001", Name: "Keyboard", PriceCents: 5000, Quantity: 1, LineTotalCents: 5000},
			},
			ItemCount:     1,
			SubtotalCents: 5000,
			Currency:      "USD",
		}
		req := internal.OrderRequest{
			Customer: internal.Customer{Name: "Grace Hopper", Email: "grace@example.com"},
			ShippingAddress: internal.ShippingAddress{
				Line1: "1 Compiler Way", City: "NYC", PostalCode: "10001", Country: "US",
			},
		}
		o, _, err := store.Create(ctx, sessionID, uuid.NewString(), req, cart)
		if err != nil {
			t.Fatalf("create order: %v", err)
		}
		return o
	}

	// 1. Happy path: PLACED -> CONFIRMED -> SHIPPED -> DELIVERED
	o1 := newOrder()
	// Skipping CONFIRMED (PLACED -> SHIPPED) must fail
	if _, err := store.UpdateStatus(ctx, sessionID, o1.ID, internal.StatusShipped); !errors.Is(err, internal.ErrInvalidTransition) {
		t.Fatalf("PLACED -> SHIPPED: want ErrInvalidTransition, got %v", err)
	}
	for _, next := range []string{internal.StatusConfirmed, internal.StatusShipped, internal.StatusDelivered} {
		updated, err := store.UpdateStatus(ctx, sessionID, o1.ID, next)
		if err != nil {
			t.Fatalf("transition to %s: %v", next, err)
		}
		if updated.Status != next || updated.UpdatedAt == "" || len(updated.Items) != 1 {
			t.Fatalf("unexpected updated order: %+v", updated)
		}
	}
	// Terminal DELIVERED cannot transition further
	for _, target := range []string{internal.StatusConfirmed, internal.StatusCancelled, internal.StatusPlaced} {
		if _, err := store.UpdateStatus(ctx, sessionID, o1.ID, target); !errors.Is(err, internal.ErrInvalidTransition) {
			t.Fatalf("DELIVERED -> %s: want ErrInvalidTransition, got %v", target, err)
		}
	}

	// 2. PLACED -> CANCELLED (terminal)
	o2 := newOrder()
	cancelled, err := store.UpdateStatus(ctx, sessionID, o2.ID, internal.StatusCancelled)
	if err != nil || cancelled.Status != internal.StatusCancelled {
		t.Fatalf("PLACED -> CANCELLED: got status=%s err=%v", cancelled.Status, err)
	}
	if _, err := store.UpdateStatus(ctx, sessionID, o2.ID, internal.StatusConfirmed); !errors.Is(err, internal.ErrInvalidTransition) {
		t.Fatalf("CANCELLED -> CONFIRMED: want ErrInvalidTransition, got %v", err)
	}

	// 3. PLACED -> CONFIRMED -> CANCELLED
	o3 := newOrder()
	if _, err := store.UpdateStatus(ctx, sessionID, o3.ID, internal.StatusConfirmed); err != nil {
		t.Fatalf("PLACED -> CONFIRMED: %v", err)
	}
	if _, err := store.UpdateStatus(ctx, sessionID, o3.ID, internal.StatusCancelled); err != nil {
		t.Fatalf("CONFIRMED -> CANCELLED: %v", err)
	}

	// 4. Non-existent order or wrong session -> ErrOrderNotFound
	if _, err := store.UpdateStatus(ctx, sessionID, uuid.NewString(), internal.StatusConfirmed); !errors.Is(err, internal.ErrOrderNotFound) {
		t.Fatalf("unknown order: want ErrOrderNotFound, got %v", err)
	}
	if _, err := store.UpdateStatus(ctx, otherSessionID, o1.ID, internal.StatusConfirmed); !errors.Is(err, internal.ErrOrderNotFound) {
		t.Fatalf("wrong session: want ErrOrderNotFound, got %v", err)
	}
}

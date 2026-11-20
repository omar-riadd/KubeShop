package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	cartTTL     = 24 * time.Hour
	minQuantity = 1
	maxQuantity = 20
)

// ErrQuantityOutOfRange is returned when a line quantity is outside [1, 20].
var ErrQuantityOutOfRange = errors.New("quantity must be between 1 and 20")

// CartItem matches Shared Contract §1.7 CartItem schema.
type CartItem struct {
	ProductID      string `json:"productId"`
	Name           string `json:"name"`
	PriceCents     int    `json:"priceCents"`
	Quantity       int    `json:"quantity"`
	LineTotalCents int    `json:"lineTotalCents"`
	ImageURL       string `json:"imageUrl"`
}

// Cart matches Shared Contract §1.7 Cart schema.
type Cart struct {
	Items         []CartItem `json:"items"`
	ItemCount     int        `json:"itemCount"`
	SubtotalCents int        `json:"subtotalCents"`
	Currency      string     `json:"currency"`
}

type storedItem struct {
	Name       string `json:"name"`
	PriceCents int    `json:"priceCents"`
	Quantity   int    `json:"quantity"`
	ImageURL   string `json:"imageUrl"`
	AddedAt    int64  `json:"addedAt"`
}

// Store persists session carts in Redis.
type Store struct {
	rdb *redis.Client
}

// NewStore creates a Redis-backed cart Store.
func NewStore(rdb *redis.Client) *Store {
	return &Store{rdb: rdb}
}

func cartKey(sessionID string) string {
	return "cart:" + sessionID
}

// Ping checks Redis connectivity.
func (s *Store) Ping(ctx context.Context) error {
	return s.rdb.Ping(ctx).Err()
}

// Get returns the current session cart (empty cart if none exists).
func (s *Store) Get(ctx context.Context, sessionID string) (Cart, error) {
	raw, err := s.rdb.HGetAll(ctx, cartKey(sessionID)).Result()
	if err != nil {
		return Cart{}, fmt.Errorf("redis hgetall: %w", err)
	}
	return buildCart(raw)
}

// AddItem adds quantity to an existing line (or creates a new line) and refreshes the 24h TTL.
func (s *Store) AddItem(ctx context.Context, sessionID string, product CatalogProduct, delta int) (Cart, error) {
	if delta < minQuantity || delta > maxQuantity {
		return Cart{}, ErrQuantityOutOfRange
	}

	key := cartKey(sessionID)
	existingRaw, err := s.rdb.HGet(ctx, key, product.ID).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return Cart{}, fmt.Errorf("redis hget: %w", err)
	}

	item := storedItem{
		Name:       product.Name,
		PriceCents: product.PriceCents,
		Quantity:   delta,
		ImageURL:   product.ImageURL,
		AddedAt:    time.Now().UnixNano(),
	}
	if err == nil {
		var prev storedItem
		if unmarshalErr := json.Unmarshal([]byte(existingRaw), &prev); unmarshalErr == nil {
			newQty := prev.Quantity + delta
			if newQty > maxQuantity {
				return Cart{}, ErrQuantityOutOfRange
			}
			item.Quantity = newQty
			item.AddedAt = prev.AddedAt
		}
	}

	encoded, err := json.Marshal(item)
	if err != nil {
		return Cart{}, fmt.Errorf("marshal cart item: %w", err)
	}

	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, key, product.ID, encoded)
	pipe.Expire(ctx, key, cartTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return Cart{}, fmt.Errorf("redis hset/expire: %w", err)
	}

	return s.Get(ctx, sessionID)
}

// SetItem sets the absolute quantity of a product line (creating it if missing) and refreshes TTL.
func (s *Store) SetItem(ctx context.Context, sessionID string, product CatalogProduct, quantity int) (Cart, error) {
	if quantity < minQuantity || quantity > maxQuantity {
		return Cart{}, ErrQuantityOutOfRange
	}

	key := cartKey(sessionID)
	addedAt := time.Now().UnixNano()
	if existingRaw, err := s.rdb.HGet(ctx, key, product.ID).Result(); err == nil {
		var prev storedItem
		if unmarshalErr := json.Unmarshal([]byte(existingRaw), &prev); unmarshalErr == nil && prev.AddedAt > 0 {
			addedAt = prev.AddedAt
		}
	} else if !errors.Is(err, redis.Nil) {
		return Cart{}, fmt.Errorf("redis hget: %w", err)
	}

	item := storedItem{
		Name:       product.Name,
		PriceCents: product.PriceCents,
		Quantity:   quantity,
		ImageURL:   product.ImageURL,
		AddedAt:    addedAt,
	}
	encoded, err := json.Marshal(item)
	if err != nil {
		return Cart{}, fmt.Errorf("marshal cart item: %w", err)
	}

	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, key, product.ID, encoded)
	pipe.Expire(ctx, key, cartTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return Cart{}, fmt.Errorf("redis hset/expire: %w", err)
	}

	return s.Get(ctx, sessionID)
}

// RemoveItem deletes a single product line from the cart (idempotent).
func (s *Store) RemoveItem(ctx context.Context, sessionID, productID string) (Cart, error) {
	key := cartKey(sessionID)
	if err := s.rdb.HDel(ctx, key, productID).Err(); err != nil {
		return Cart{}, fmt.Errorf("redis hdel: %w", err)
	}
	_ = s.rdb.Expire(ctx, key, cartTTL).Err()
	return s.Get(ctx, sessionID)
}

// Clear removes the entire session cart and returns an empty Cart.
func (s *Store) Clear(ctx context.Context, sessionID string) (Cart, error) {
	if err := s.rdb.Del(ctx, cartKey(sessionID)).Err(); err != nil {
		return Cart{}, fmt.Errorf("redis del: %w", err)
	}
	return emptyCart(), nil
}

func emptyCart() Cart {
	return Cart{
		Items:         []CartItem{},
		ItemCount:     0,
		SubtotalCents: 0,
		Currency:      "USD",
	}
}

func buildCart(raw map[string]string) (Cart, error) {
	if len(raw) == 0 {
		return emptyCart(), nil
	}

	type entry struct {
		productID string
		item      storedItem
	}
	entries := make([]entry, 0, len(raw))
	for pid, val := range raw {
		var si storedItem
		if err := json.Unmarshal([]byte(val), &si); err != nil {
			return Cart{}, fmt.Errorf("unmarshal stored cart item %s: %w", pid, err)
		}
		entries = append(entries, entry{productID: pid, item: si})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].item.AddedAt != entries[j].item.AddedAt {
			return entries[i].item.AddedAt < entries[j].item.AddedAt
		}
		return entries[i].productID < entries[j].productID
	})

	cart := emptyCart()
	cart.Items = make([]CartItem, 0, len(entries))
	for _, e := range entries {
		lineTotal := e.item.PriceCents * e.item.Quantity
		cart.Items = append(cart.Items, CartItem{
			ProductID:      e.productID,
			Name:           e.item.Name,
			PriceCents:     e.item.PriceCents,
			Quantity:       e.item.Quantity,
			LineTotalCents: lineTotal,
			ImageURL:       e.item.ImageURL,
		})
		cart.ItemCount += e.item.Quantity
		cart.SubtotalCents += lineTotal
	}
	return cart, nil
}

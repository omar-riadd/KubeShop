package internal

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/kubeshop/kubeshop-platform/services/catalog/seed"
)

// Product matches the Shared Contract §1.7 Product schema.
type Product struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	PriceCents  int    `json:"priceCents"`
	Currency    string `json:"currency"`
	ImageURL    string `json:"imageUrl"`
}

// Category matches the Shared Contract §1.7 Category schema.
type Category struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

var defaultCategories = []Category{
	{ID: "keyboards", Label: "Keyboards"},
	{ID: "mice", Label: "Mice"},
	{ID: "audio", Label: "Audio"},
	{ID: "accessories", Label: "Accessories"},
}

// Store holds the immutable in-memory product catalog.
type Store struct {
	products   []Product
	byID       map[string]Product
	categories []Category
}

// NewStore loads the embedded seed products and sorts them by id ascending.
func NewStore() (*Store, error) {
	var products []Product
	if err := json.Unmarshal(seed.ProductsJSON, &products); err != nil {
		return nil, fmt.Errorf("unmarshal seed products: %w", err)
	}
	if len(products) == 0 {
		return nil, fmt.Errorf("seed products list is empty")
	}

	sort.Slice(products, func(i, j int) bool {
		return products[i].ID < products[j].ID
	})

	byID := make(map[string]Product, len(products))
	for _, p := range products {
		byID[p.ID] = p
	}

	cats := make([]Category, len(defaultCategories))
	copy(cats, defaultCategories)

	return &Store{
		products:   products,
		byID:       byID,
		categories: cats,
	}, nil
}

// List returns matching products (filtered by category and case-insensitive substring q),
// paginated by limit and offset, along with total matches before pagination.
func (s *Store) List(category, q string, limit, offset int) ([]Product, int) {
	cat := strings.TrimSpace(category)
	query := strings.ToLower(strings.TrimSpace(q))

	filtered := make([]Product, 0, len(s.products))
	for _, p := range s.products {
		if cat != "" && p.Category != cat {
			continue
		}
		if query != "" {
			if !strings.Contains(strings.ToLower(p.Name), query) &&
				!strings.Contains(strings.ToLower(p.Description), query) {
				continue
			}
		}
		filtered = append(filtered, p)
	}

	total := len(filtered)
	if offset >= total {
		return []Product{}, total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	result := make([]Product, end-offset)
	copy(result, filtered[offset:end])
	return result, total
}

// Get returns a product by ID.
func (s *Store) Get(id string) (Product, bool) {
	p, ok := s.byID[id]
	return p, ok
}

// Categories returns the fixed list of catalog categories.
func (s *Store) Categories() []Category {
	out := make([]Category, len(s.categories))
	copy(out, s.categories)
	return out
}

// Ready reports whether the seed catalog is loaded.
func (s *Store) Ready() bool {
	return len(s.products) > 0
}

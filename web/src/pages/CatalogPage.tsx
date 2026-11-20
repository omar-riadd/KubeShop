import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon, ShoppingCart } from 'lucide-react';
import { useProducts, useCategories } from '../api/catalog';
import { useAddToCart } from '../api/cart';
import { useToast } from '../components/ui/Toast';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Money } from '../components/ui/Money';
import { getUserErrorMessage } from '../api/errors';

export const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = searchParams.get('category') || '';
  const currentQ = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(currentQ);
  const { data: categoriesData } = useCategories();
  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useProducts({
    category: currentCategory || undefined,
    q: currentQ || undefined,
  });

  const addToCartMutation = useAddToCart();
  const { showToast } = useToast();

  // Debounce search input sync to URL (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (searchInput.trim()) {
            next.set('q', searchInput.trim());
          } else {
            next.delete('q');
          }
          return next;
        },
        { replace: true }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  const setCategory = (catId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (catId) {
          next.set('category', catId);
        } else {
          next.delete('category');
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    try {
      await addToCartMutation.mutateAsync({ productId, quantity: 1 });
      showToast({
        type: 'success',
        message: `Added ${productName} to cart.`,
      });
    } catch (err: unknown) {
      const { message, requestId } = getUserErrorMessage(err);
      showToast({
        type: 'error',
        message: `Could not add item: ${message}`,
        requestId,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">
          Gear for engineers who ship.
        </h1>
        <p className="text-text-muted text-sm max-w-xl">
          High-performance keyboards, precision mice, and desk gear tuned for production.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative max-w-md w-full">
          <SearchIcon className="w-4 h-4 absolute left-3 top-3 text-text-muted pointer-events-none" />
          <Input
            data-testid="search-input"
            type="search"
            placeholder="Search products..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Categories chips */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            onClick={() => setCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              !currentCategory
                ? 'bg-primary text-primary-contrast border-primary'
                : 'bg-surface text-text-muted border-border hover:bg-border/30'
            }`}
          >
            All
          </button>
          {categoriesData?.items.map((cat) => {
            const active = currentCategory === cat.id;
            return (
              <button
                key={cat.id}
                data-testid={`category-chip-${cat.id}`}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-primary-contrast border-primary'
                    : 'bg-surface text-text-muted border-border hover:bg-border/30'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product count */}
      {!isLoading && !error && (
        <div className="text-xs text-text-muted font-medium">
          {productsData?.total ?? 0} {productsData?.total === 1 ? 'product' : 'products'}
        </div>
      )}

      {/* Error State */}
      {Boolean(error) && (
        <ErrorState
          message={getUserErrorMessage(error).message}
          requestId={getUserErrorMessage(error).requestId}
          onRetry={() => refetch()}
        />
      )}

      {/* Loading Skeleton Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <Skeleton className="w-full h-48 rounded-md" />
              <Skeleton className="w-20 h-5" />
              <Skeleton className="w-full h-6" />
              <Skeleton className="w-16 h-5" />
              <Skeleton className="w-full h-10 mt-2" />
            </Card>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {!isLoading && !error && productsData && productsData.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productsData.items.map((prod) => (
            <Card
              key={prod.id}
              data-testid={`product-card-${prod.id}`}
              className="flex flex-col justify-between group hover:border-primary/50 transition-colors"
            >
              <div>
                <Link
                  to={`/products/${prod.id}`}
                  className="block overflow-hidden rounded-md focus-visible:outline-offset-2"
                >
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    width={400}
                    height={300}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/images/placeholder.svg';
                    }}
                    className="w-full h-48 object-cover bg-surface rounded-md transition-transform duration-200 group-hover:scale-102"
                  />
                  <div className="mt-3">
                    <Badge variant="default" className="capitalize text-[11px] mb-1.5">
                      {prod.category}
                    </Badge>
                    <h2 className="text-base font-semibold text-text group-hover:text-primary transition-colors line-clamp-1">
                      {prod.name}
                    </h2>
                  </div>
                </Link>
                <p className="text-xs text-text-muted mt-1 line-clamp-2">{prod.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <Money
                  cents={prod.priceCents}
                  currency={prod.currency}
                  className="text-base font-bold text-text"
                />
                <Button
                  data-testid={`add-to-cart-${prod.id}`}
                  size="sm"
                  onClick={() => handleAddToCart(prod.id, prod.name)}
                  loading={
                    addToCartMutation.isPending &&
                    addToCartMutation.variables?.productId === prod.id
                  }
                  className="gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to cart
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && productsData && productsData.items.length === 0 && (
        <EmptyState
          title="No products match your search"
          description="Try adjusting your filters or search keywords."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchInput('');
                setCategory('');
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  );
};

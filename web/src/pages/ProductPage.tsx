import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Check, SlidersHorizontal } from 'lucide-react';
import { useProduct, useProducts } from '../api/catalog';
import { useAddToCart } from '../api/cart';
import { useCartDrawer } from '../context/CartDrawerContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Money } from '../components/ui/Money';
import { NotFoundPage } from './NotFoundPage';
import { getUserErrorMessage } from '../api/errors';
import { WhatsInTheBox } from '../components/product/WhatsInTheBox';
import { SpecComparisonModal } from '../components/product/SpecComparisonModal';
import { BundleOffer } from '../components/product/BundleOffer';
import { StickyQuickBuy } from '../components/product/StickyQuickBuy';

export const ProductPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);

  // Validate ID format before calling API per §7
  const isValidId = /^[a-z]{2}-\d{3}$/.test(id);

  const { data: product, isLoading, error, refetch } = useProduct(isValidId ? id : '');
  const { data: productsData } = useProducts({ limit: 50 });
  const addToCartMutation = useAddToCart();
  const { openDrawer } = useCartDrawer();
  const { showToast } = useToast();

  if (!isValidId) {
    return <NotFoundPage />;
  }

  if (error) {
    const { message, requestId } = getUserErrorMessage(error);
    if (message === "That product doesn't exist.") {
      return <NotFoundPage />;
    }
    return <ErrorState message={message} requestId={requestId} onRetry={() => refetch()} />;
  }

  if (isLoading || !product) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-32 h-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Skeleton className="w-full h-80 rounded-md" />
          <div className="space-y-4">
            <Skeleton className="w-20 h-6" />
            <Skeleton className="w-3/4 h-10" />
            <Skeleton className="w-24 h-8" />
            <Skeleton className="w-full h-24" />
            <Skeleton className="w-48 h-10" />
          </div>
        </div>
      </div>
    );
  }

  const handleAddToCart = async () => {
    try {
      await addToCartMutation.mutateAsync({ productId: product.id, quantity });
      setAdded(true);
      showToast({
        type: 'success',
        message: `Added ${quantity} × ${product.name} to cart.`,
      });
      openDrawer();
      setTimeout(() => setAdded(false), 2000);
    } catch (err: unknown) {
      const { message, requestId } = getUserErrorMessage(err);
      showToast({
        type: 'error',
        message: `Failed to add to cart: ${message}`,
        requestId,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to catalog
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Product image */}
        <div className="relative bg-surface border border-border rounded-lg overflow-hidden p-6 sm:p-8 flex items-center justify-center shadow-xs">
          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            In Stock &amp; Ready to Ship
          </div>
          <img
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={300}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/placeholder.svg';
            }}
            className="w-full max-h-80 object-contain rounded-md"
          />
        </div>

        {/* Product details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="default" className="capitalize text-xs">
                {product.category}
              </Badge>
              <span className="text-xs font-semibold text-text flex items-center gap-1">
                <span className="text-amber-400">★★★★★</span> 4.9 · 142 reviews
              </span>
            </div>
            <h1 data-testid="product-title" className="text-2xl sm:text-3xl font-bold text-text">
              {product.name}
            </h1>
            <div className="mt-3">
              <Money
                cents={product.priceCents}
                currency={product.currency}
                className="text-2xl font-bold text-primary"
              />
            </div>
          </div>

          <p className="text-sm text-text-muted leading-relaxed border-t border-border pt-4">
            {product.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-3 border-t border-b border-border text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span>🛡️</span>
              <span className="font-medium">2-Year Warranty</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>⚡</span>
              <span className="font-medium">Sub-ms Latency</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>📦</span>
              <span className="font-medium">Free Global Dispatch</span>
            </div>
          </div>

          <div id="main-add-to-cart-container" className="space-y-4">
            <div className="flex items-center gap-4">
              <label htmlFor="qty-input" className="text-sm font-medium text-text">
                Quantity:
              </label>
              <QuantityStepper
                id="qty-input"
                data-testid="qty-input"
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={20}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                data-testid="add-to-cart"
                size="lg"
                className="w-full sm:w-auto min-w-48 gap-2 font-bold"
                onClick={handleAddToCart}
                loading={addToCartMutation.isPending}
              >
                {added ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                {added ? 'Added!' : 'Add to cart'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setSpecModalOpen(true)}
                className="gap-2 text-xs font-semibold"
                data-testid="compare-specs-button"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Compare Specs
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together Bundle */}
      <BundleOffer currentProduct={product} allProducts={productsData?.items || []} />

      {/* What's in the Box Unboxing Grid */}
      <WhatsInTheBox product={product} />

      {/* Side-by-Side Model Comparison Modal */}
      <SpecComparisonModal
        open={specModalOpen}
        onClose={() => setSpecModalOpen(false)}
        currentProduct={product}
        allProducts={productsData?.items || []}
      />

      {/* Sticky Quick-Buy Scroll Bar */}
      <StickyQuickBuy
        product={product}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onAddToCart={handleAddToCart}
        loading={addToCartMutation.isPending}
        added={added}
        targetRefId="main-add-to-cart-container"
      />
    </div>
  );
};

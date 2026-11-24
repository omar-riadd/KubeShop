import React, { useState } from 'react';
import { Plus, Check, ShoppingBag, Sparkles } from 'lucide-react';
import type { Product } from '../../api/types';
import { useAddToCart } from '../../api/cart';
import { useCartDrawer } from '../../context/CartDrawerContext';
import { useToast } from '../ui/Toast';
import { Money } from '../ui/Money';
import { Button } from '../ui/Button';

interface BundleOfferProps {
  currentProduct: Product;
  allProducts: Product[];
}

export const BundleOffer: React.FC<BundleOfferProps> = ({ currentProduct, allProducts }) => {
  const { openDrawer } = useCartDrawer();
  const addToCartMutation = useAddToCart();
  const { showToast } = useToast();
  const [includeCompanion, setIncludeCompanion] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Pick a logical companion product based on category
  const getCompanion = (): Product | undefined => {
    switch (currentProduct.category) {
      case 'keyboards':
        // Pair with Rollout Desk Mat XL (ac-001) or Orbit Mouse (ms-001)
        return (
          allProducts.find((p) => p.id === 'ac-001') || allProducts.find((p) => p.id === 'ms-001')
        );
      case 'mice':
        // Pair with Rollout Desk Mat XL (ac-001) or Nimbus 75 (kb-001)
        return (
          allProducts.find((p) => p.id === 'ac-001') || allProducts.find((p) => p.id === 'kb-001')
        );
      case 'audio':
        // Pair with Cluster USB-C Hub (ac-002)
        return allProducts.find((p) => p.id === 'ac-002');
      default:
        // Accessories pair with Nimbus 75 (kb-001) or Orbit Mouse (ms-001)
        return (
          allProducts.find((p) => p.id === 'kb-001') || allProducts.find((p) => p.id === 'ms-001')
        );
    }
  };

  const companion = getCompanion();
  if (!companion || companion.id === currentProduct.id) return null;

  // 10% discount on companion item in bundle
  const companionDiscountCents = Math.round(companion.priceCents * 0.9);
  const savingsCents = companion.priceCents - companionDiscountCents;
  const bundleTotalCents = includeCompanion
    ? currentProduct.priceCents + companionDiscountCents
    : currentProduct.priceCents;

  const handleAddBundle = async () => {
    setIsAdding(true);
    try {
      // Add current product
      await addToCartMutation.mutateAsync({ productId: currentProduct.id, quantity: 1 });
      // Add companion product if selected
      if (includeCompanion) {
        await addToCartMutation.mutateAsync({ productId: companion.id, quantity: 1 });
      }

      setAdded(true);
      showToast({
        type: 'success',
        message: includeCompanion
          ? `Bundle added! Saved $${(savingsCents / 100).toFixed(2)} on companion accessory.`
          : `Added ${currentProduct.name} to cart.`,
      });

      // Open slide-out cart drawer
      openDrawer();
      setTimeout(() => setAdded(false), 2500);
    } catch {
      showToast({
        type: 'error',
        message: 'Failed to add bundle to cart.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section
      aria-labelledby="bundle-offer-heading"
      className="border-t border-border pt-8 mt-8 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 id="bundle-offer-heading" className="text-lg font-bold text-text">
            Frequently Bought Together
          </h2>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
          Save 10% on companion
        </span>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Thumbnails + Plus */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
            {/* Primary Product */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-md bg-surface-muted border border-border p-2 flex items-center justify-center shrink-0">
                <img
                  src={currentProduct.imageUrl}
                  alt={currentProduct.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 max-w-44">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  This Item
                </span>
                <p className="text-xs font-semibold text-text truncate">{currentProduct.name}</p>
                <Money
                  cents={currentProduct.priceCents}
                  currency={currentProduct.currency}
                  className="text-xs font-mono font-bold text-text-muted"
                />
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-text-muted shrink-0">
              <Plus className="w-4 h-4" />
            </div>

            {/* Companion Product */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-md bg-surface-muted border border-border p-2 flex items-center justify-center shrink-0">
                <img
                  src={companion.imageUrl}
                  alt={companion.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 max-w-44">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCompanion}
                    onChange={(e) => setIncludeCompanion(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Companion Add-on
                  </span>
                </label>
                <p className="text-xs font-semibold text-text truncate">{companion.name}</p>
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <Money
                    cents={companionDiscountCents}
                    currency={companion.currency}
                    className="font-bold text-primary"
                  />
                  <span className="line-through text-text-muted text-[11px]">
                    ${(companion.priceCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & CTA */}
          <div className="lg:border-l lg:border-border lg:pl-6 space-y-2.5 w-full lg:w-auto shrink-0">
            <div>
              <span className="text-xs text-text-muted block">Bundle Total Price:</span>
              <div className="flex items-baseline gap-2">
                <Money
                  cents={bundleTotalCents}
                  currency={currentProduct.currency}
                  className="text-2xl font-bold font-mono text-text"
                />
                {includeCompanion && (
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    (You save ${(savingsCents / 100).toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full lg:w-auto gap-2 font-bold shadow-xs"
              onClick={handleAddBundle}
              loading={isAdding}
              data-testid="add-bundle-to-cart"
            >
              {added ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              {added ? 'Bundle Added!' : includeCompanion ? 'Add Both to Cart' : 'Add to Cart'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

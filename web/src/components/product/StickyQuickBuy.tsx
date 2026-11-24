import React, { useEffect, useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import type { Product } from '../../api/types';
import { Money } from '../ui/Money';
import { Button } from '../ui/Button';
import { QuantityStepper } from '../ui/QuantityStepper';

interface StickyQuickBuyProps {
  product: Product;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToCart: () => void;
  loading: boolean;
  added: boolean;
  targetRefId?: string;
}

export const StickyQuickBuy: React.FC<StickyQuickBuyProps> = ({
  product,
  quantity,
  onQuantityChange,
  onAddToCart,
  loading,
  added,
  targetRefId = 'main-add-to-cart-container',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const target = document.getElementById(targetRefId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar only when the main add-to-cart button has scrolled ABOVE the viewport
        const isPastMainBtn = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setIsVisible(isPastMainBtn);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRefId]);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Quick buy bar"
      className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border shadow-2xl py-3 px-4 animate-in slide-in-from-bottom duration-300"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Product summary */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-sm bg-surface-muted border border-border p-1 shrink-0 hidden sm:flex items-center justify-center">
            <img
              src={product.imageUrl || '/images/placeholder.svg'}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text truncate">{product.name}</h3>
            <div className="flex items-center gap-2 text-xs">
              <Money
                cents={product.priceCents}
                currency={product.currency}
                className="font-bold text-primary"
              />
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold hidden md:inline">
                ● In Stock &amp; Ready to Ship
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block">
            <QuantityStepper value={quantity} onChange={onQuantityChange} min={1} max={20} />
          </div>

          <Button
            size="md"
            variant="primary"
            onClick={onAddToCart}
            loading={loading}
            className="gap-2 font-semibold shadow-xs"
            data-testid="sticky-add-to-cart"
          >
            {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
            <span>{added ? 'Added!' : 'Add to Cart'}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};

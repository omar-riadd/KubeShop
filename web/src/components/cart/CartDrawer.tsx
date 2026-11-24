import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ShoppingBag, ArrowRight, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
import { useCart, useSetCartItem, useRemoveCartItem } from '../../api/cart';
import { useCartDrawer } from '../../context/CartDrawerContext';
import { Money } from '../ui/Money';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { QuantityStepper } from '../ui/QuantityStepper';
import { formatMoney } from '../../lib/money';
import { calculateFreeShippingProgress } from '../../lib/shipping';

export const CartDrawer: React.FC = () => {
  const { isOpen, closeDrawer } = useCartDrawer();
  const { data: cart } = useCart();
  const setItemMutation = useSetCartItem();
  const removeItemMutation = useRemoveCartItem();
  const navigate = useNavigate();

  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus drawer or first interactive element
      drawerRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDrawer]);

  const subtotalCents = cart?.subtotalCents || 0;
  const currency = cart?.currency || 'USD';
  const {
    hasFreeShipping,
    remainingCents: remainingForFreeShipping,
    progressPercent: freeShippingProgress,
  } = calculateFreeShippingProgress(subtotalCents, currency);

  const handleCheckout = () => {
    closeDrawer();
    navigate('/checkout');
  };

  const handleViewCart = () => {
    closeDrawer();
    navigate('/cart');
  };

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDrawer();
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart Drawer"
        tabIndex={-1}
        className="w-full max-w-md bg-surface text-text border-l border-border shadow-2xl flex flex-col h-full focus:outline-none animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-text">Your Cart</h2>
            {cart && cart.itemCount > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <IconButton
            label="Close cart drawer"
            size="sm"
            onClick={closeDrawer}
            data-testid="close-cart-drawer"
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Free Shipping Progress Bar */}
        <div className="px-5 py-3.5 bg-surface-muted/50 border-b border-border text-xs">
          {hasFreeShipping ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Unlocked!</strong> Free Priority SRE Dispatch applied to order.
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-text-muted mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                Add{' '}
                <strong className="text-text font-mono">
                  {formatMoney(remainingForFreeShipping, currency)}
                </strong>{' '}
                for Free SRE Dispatch
              </span>
              <span className="font-mono text-[11px] font-semibold">{freeShippingProgress}%</span>
            </div>
          )}
          <div
            className="w-full h-1.5 bg-border rounded-full overflow-hidden mt-2"
            role="progressbar"
            aria-valuenow={freeShippingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Free shipping progress"
          >
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                hasFreeShipping ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Cart items list or empty state */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 divide-y divide-border/60">
          {!cart || cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-surface-muted flex items-center justify-center text-text-muted">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="font-semibold text-text text-base">Your cart is empty</h3>
              <p className="text-xs text-text-muted max-w-xs">
                Explore our production-grade Kubernetes hardware, nodes, and security keys.
              </p>
              <Button size="sm" variant="primary" onClick={closeDrawer} className="mt-2">
                Continue Shopping
              </Button>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.productId} className="pt-4 first:pt-0 flex gap-3.5 items-start">
                <Link
                  to={`/products/${item.productId}`}
                  onClick={closeDrawer}
                  className="shrink-0 w-16 h-16 rounded-md bg-surface border border-border overflow-hidden p-1 flex items-center justify-center hover:opacity-85 transition-opacity"
                >
                  <img
                    src={item.imageUrl || '/images/placeholder.svg'}
                    alt={item.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${item.productId}`}
                    onClick={closeDrawer}
                    className="text-xs font-semibold text-text hover:text-primary transition-colors line-clamp-1"
                  >
                    {item.name}
                  </Link>

                  <div className="mt-0.5 text-xs text-text-muted font-mono">
                    <Money cents={item.priceCents} currency={currency} />
                  </div>

                  <div className="flex items-center justify-between mt-2.5">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(newQty) =>
                        setItemMutation.mutate({ productId: item.productId, quantity: newQty })
                      }
                      min={1}
                      max={20}
                    />

                    <button
                      type="button"
                      onClick={() => removeItemMutation.mutate(item.productId)}
                      aria-label={`Remove ${item.name}`}
                      className="p-1 text-text-muted hover:text-danger rounded transition-colors focus-visible:outline-offset-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {cart && cart.items.length > 0 && (
          <div className="border-t border-border p-5 bg-surface-muted/30 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-text font-semibold text-sm">
                <span>Subtotal</span>
                <Money cents={subtotalCents} currency={currency} className="font-mono text-base" />
              </div>
              <p className="text-text-muted text-[11px]">
                Taxes and delivery calculated at checkout.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full gap-2 font-bold shadow-md"
              onClick={handleCheckout}
              data-testid="drawer-checkout-button"
            >
              Checkout Now <ArrowRight className="w-4 h-4" />
            </Button>

            <button
              type="button"
              onClick={handleViewCart}
              className="w-full py-1 text-center text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              View Full Shopping Cart →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

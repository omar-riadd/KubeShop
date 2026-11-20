import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ArrowRight, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart, useSetCartItem, useRemoveCartItem, useClearCart } from '../api/cart';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Card } from '../components/ui/Card';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Money } from '../components/ui/Money';
import { getUserErrorMessage } from '../api/errors';

export const CartPage: React.FC = () => {
  const { data: cart, isLoading, error, refetch } = useCart();
  const setItemMutation = useSetCartItem();
  const removeItemMutation = useRemoveCartItem();
  const clearCartMutation = useClearCart();
  const { showToast } = useToast();

  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleQuantityChange = async (productId: string, quantity: number) => {
    try {
      await setItemMutation.mutateAsync({ productId, quantity });
    } catch (err) {
      const { message, requestId } = getUserErrorMessage(err);
      showToast({
        type: 'error',
        message: message || 'Failed to update item quantity',
        requestId,
      });
    }
  };

  const handleRemoveItem = async (productId: string) => {
    try {
      await removeItemMutation.mutateAsync(productId);
      showToast({
        type: 'info',
        message: 'Item removed from cart',
      });
    } catch (err) {
      const { message, requestId } = getUserErrorMessage(err);
      showToast({
        type: 'error',
        message: message || 'Failed to remove item',
        requestId,
      });
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCartMutation.mutateAsync();
      setClearDialogOpen(false);
      showToast({
        type: 'info',
        message: 'Cart cleared',
      });
    } catch (err) {
      const { message, requestId } = getUserErrorMessage(err);
      showToast({
        type: 'error',
        message: message || 'Failed to clear cart',
        requestId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !cart) {
    const { message, requestId } = getUserErrorMessage(error);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorState
          title="Could not load your cart"
          message={message}
          requestId={requestId}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Looks like you haven't added any Kubernetes gear to your cart yet."
          action={
            <Button asChild variant="primary">
              <Link to="/">Browse Catalog</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Shopping Cart</h1>
          <p className="text-sm text-text-muted mt-1">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setClearDialogOpen(true)}
          className="text-danger hover:text-danger hover:border-danger/30 self-start sm:self-auto"
        >
          Clear Cart
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items list */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <Card key={item.productId} className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link
                  to={`/products/${item.productId}`}
                  className="shrink-0 w-20 h-20 bg-surface-muted rounded overflow-hidden border border-border flex items-center justify-center"
                >
                  <img
                    src={item.imageUrl || '/images/placeholder.svg'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${item.productId}`}
                    className="text-base font-semibold text-text hover:text-primary transition-colors line-clamp-1"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs font-mono text-text-muted mt-0.5">SKU: {item.productId}</p>
                  <div className="mt-2 text-sm text-text-muted">
                    Unit: <Money priceCents={item.priceCents} className="font-medium text-text" />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <QuantityStepper
                    value={item.quantity}
                    min={1}
                    max={20}
                    disabled={setItemMutation.isPending}
                    onChange={(qty) => handleQuantityChange(item.productId, qty)}
                    data-testid={`quantity-stepper-${item.productId}`}
                  />
                  <div className="text-right min-w-[70px]">
                    <Money
                      priceCents={item.priceCents * item.quantity}
                      className="text-base font-bold text-text"
                    />
                  </div>
                  <IconButton
                    label="Remove item"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(item.productId)}
                    disabled={removeItemMutation.isPending}
                    className="text-text-muted hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}

          <div className="pt-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-20">
            <h2 className="text-lg font-bold text-text pb-4 border-b border-border">
              Order Summary
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-text-muted">
                <dt>Subtotal ({cart.itemCount} items)</dt>
                <dd>
                  <Money priceCents={cart.subtotalCents} className="font-medium text-text" />
                </dd>
              </div>

              <div className="flex items-center justify-between text-text-muted">
                <dt>Standard Shipping</dt>
                <dd className="text-success font-medium">Free</dd>
              </div>

              <div className="flex items-center justify-between text-text-muted">
                <dt>Estimated Tax</dt>
                <dd className="font-mono text-xs">$0.00</dd>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <dt className="text-base font-bold text-text">Total</dt>
                <dd>
                  <Money
                    priceCents={cart.subtotalCents}
                    className="text-xl font-extrabold text-primary"
                  />
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <Button asChild variant="primary" size="lg" className="w-full">
                <Link to="/checkout" data-testid="proceed-to-checkout">
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-border text-xs text-text-muted space-y-2">
              <p>✓ All prices in USD minor integer cents</p>
              <p>✓ Fast, reliable delivery for dev teams</p>
              <p>✓ 30-day no-hassle return policy</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        title="Clear Shopping Cart"
        description="Are you sure you want to remove all items from your cart? This action cannot be undone."
      >
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleClearCart}
            isLoading={clearCartMutation.isPending}
          >
            Clear Cart
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

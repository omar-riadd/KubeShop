import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import { useOrders } from '../api/orders';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Money } from '../components/ui/Money';
import { formatDate } from '../lib/format';
import { getUserErrorMessage } from '../api/errors';

export const OrdersPage: React.FC = () => {
  const { data: ordersData, isLoading, error, refetch } = useOrders();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (error || !ordersData) {
    const { message, requestId } = getUserErrorMessage(error);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorState
          title="Could not load your orders"
          message={message}
          requestId={requestId}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (ordersData.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon={Package}
          title="No orders placed yet"
          description="Orders placed during this browser session will appear here."
          action={
            <Button asChild variant="primary">
              <Link to="/">Explore Catalog</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="pb-6 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-text">Your Orders</h1>
        <p className="text-sm text-text-muted mt-1">
          {ordersData.items.length} {ordersData.items.length === 1 ? 'order' : 'orders'} placed in
          this session
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {ordersData.items.map((order) => {
          const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

          return (
            <Card key={order.id} className="p-6 transition-all hover:border-text-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-muted">ID:</span>
                    <Link
                      to={`/orders/${order.id}`}
                      className="font-mono text-sm font-semibold text-text hover:text-primary transition-colors"
                    >
                      {order.id}
                    </Link>
                    <Badge variant="success">{order.status}</Badge>
                  </div>
                  <p className="text-xs text-text-muted">Placed on {formatDate(order.createdAt)}</p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div className="text-right">
                    <p className="text-xs text-text-muted">Total</p>
                    <Money priceCents={order.totalCents} className="text-lg font-bold text-text" />
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/orders/${order.id}`} className="gap-1">
                      Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                  <span>•</span>
                  <span>
                    Ship to: {order.customer.name} ({order.shippingAddress.city},{' '}
                    {order.shippingAddress.country})
                  </span>
                </div>
                <div className="font-mono text-[11px] truncate max-w-md">
                  {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

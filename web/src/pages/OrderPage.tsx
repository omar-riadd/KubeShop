import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, Package, User, MapPin, Calendar } from 'lucide-react';
import { useOrder } from '../api/orders';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Money } from '../components/ui/Money';
import { formatDate } from '../lib/format';
import { getUserErrorMessage } from '../api/errors';
import { NotFoundPage } from './NotFoundPage';

export const OrderPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const justPlaced = searchParams.get('placed') === 'true';

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data: order, isLoading, error, refetch } = useOrder(isUUID ? id : '');

  if (!isUUID) {
    return <NotFoundPage />;
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    const { message, requestId } = getUserErrorMessage(error);
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorState
          title="Order Not Found"
          message={message}
          requestId={requestId}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Orders
        </Link>
        <Link to="/" className="text-xs font-medium text-primary hover:underline">
          Continue Shopping
        </Link>
      </div>

      {/* Just placed banner */}
      {justPlaced && (
        <div className="p-6 rounded-md bg-success/10 border border-success/30 flex items-start gap-4">
          <CheckCircle2 className="w-8 h-8 text-success shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-text">Thank You for Your Order!</h2>
            <p className="text-sm text-text-muted">
              We've received your order and are preparing it for shipment. A confirmation email has
              been sent to <span className="font-semibold text-text">{order.customer.email}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Order Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">Order Details</h1>
            <Badge variant="success">{order.status}</Badge>
          </div>
          <p className="text-xs font-mono text-text-muted mt-1">ID: {order.id}</p>
        </div>
        <div className="text-sm text-text-muted flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span>Placed: {formatDate(order.createdAt)}</span>
        </div>
      </div>

      {/* Items list */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-text pb-4 border-b border-border flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Items in this Order
        </h2>

        <div className="divide-y divide-border">
          {order.items.map((item) => (
            <div
              key={item.productId}
              className="py-4 flex items-center justify-between gap-4 first:pt-4 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/products/${item.productId}`}
                  className="font-medium text-sm text-text hover:text-primary transition-colors block truncate"
                >
                  {item.name}
                </Link>
                <p className="text-xs font-mono text-text-muted mt-0.5">
                  SKU: {item.productId} • Qty: {item.quantity}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-text-muted">
                  <Money priceCents={item.priceCents} /> each
                </div>
                <Money
                  priceCents={item.lineTotalCents}
                  className="text-sm font-semibold text-text"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Pricing breakdown */}
        <div className="mt-6 pt-4 border-t border-border flex justify-end">
          <dl className="w-full sm:w-64 space-y-2 text-sm">
            <div className="flex justify-between text-text-muted">
              <dt>Subtotal</dt>
              <dd>
                <Money priceCents={order.totalCents} className="font-medium text-text" />
              </dd>
            </div>
            <div className="flex justify-between text-text-muted">
              <dt>Shipping</dt>
              <dd className="text-success font-medium">Free</dd>
            </div>
            <div className="flex justify-between text-text-muted">
              <dt>Estimated Tax</dt>
              <dd className="font-mono text-xs">$0.00</dd>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-bold text-text">
              <dt className="text-base">Total</dt>
              <dd>
                <Money priceCents={order.totalCents} className="text-lg text-primary" />
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Customer & Shipping information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-text pb-3 border-b border-border flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Customer Information
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-medium text-text">{order.customer.name}</p>
            <p className="text-text-muted font-mono text-xs">{order.customer.email}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-text pb-3 border-b border-border flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Shipping Address
          </h3>
          <address className="mt-4 not-italic text-sm text-text-muted space-y-1">
            <p className="font-medium text-text">{order.customer.name}</p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.postalCode}
            </p>
            <p className="font-semibold text-text">{order.shippingAddress.country}</p>
          </address>
        </Card>
      </div>
    </div>
  );
};

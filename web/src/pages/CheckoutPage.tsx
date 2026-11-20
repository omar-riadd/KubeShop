import React, { useState, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { useCart } from '../api/cart';
import { useCreateOrder } from '../api/orders';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { Money } from '../components/ui/Money';
import { generateUUID } from '../lib/uuid';
import { getUserErrorMessage, ApiError } from '../api/errors';
import type { OrderRequest } from '../api/types';

export const checkoutSchema = z.object({
  customer: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(100, 'Name must be 100 characters or less'),
    email: z.string().trim().email('Please enter a valid email address').min(3).max(254),
  }),
  shippingAddress: z.object({
    line1: z.string().trim().min(1, 'Street address is required').max(200),
    line2: z.string().trim().max(200).optional().default(''),
    city: z.string().trim().min(1, 'City is required').max(100),
    postalCode: z.string().trim().min(1, 'Postal / ZIP code is required').max(20),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'Country code must be 2 uppercase letters (e.g., US, GB)'),
  }),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;

const COUNTRIES = [
  { value: 'US', label: 'United States (US)' },
  { value: 'GB', label: 'United Kingdom (GB)' },
  { value: 'CA', label: 'Canada (CA)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'FR', label: 'France (FR)' },
  { value: 'NL', label: 'Netherlands (NL)' },
  { value: 'AU', label: 'Australia (AU)' },
  { value: 'JP', label: 'Japan (JP)' },
];

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: cart, isLoading: isCartLoading } = useCart();
  const createOrderMutation = useCreateOrder();
  const { showToast } = useToast();

  // Stable idempotency key for this checkout attempt
  const [idempotencyKey] = useState<string>(() => generateUUID());

  const nameId = useId();
  const emailId = useId();
  const line1Id = useId();
  const line2Id = useId();
  const cityId = useId();
  const postalCodeId = useId();
  const countryId = useId();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customer: {
        name: '',
        email: '',
      },
      shippingAddress: {
        line1: '',
        line2: '',
        city: '',
        postalCode: '',
        country: 'US',
      },
    },
  });

  if (isCartLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
          <Lock className="w-8 h-8 text-text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-text">Your cart is empty</h1>
        <p className="text-text-muted mt-2">
          Add some items to your cart before proceeding to checkout.
        </p>
        <div className="mt-6">
          <Button asChild variant="primary">
            <Link to="/">Browse Catalog</Link>
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: CheckoutFormData) => {
    try {
      const orderReq: OrderRequest = {
        customer: {
          name: data.customer.name,
          email: data.customer.email,
        },
        shippingAddress: {
          line1: data.shippingAddress.line1,
          line2: data.shippingAddress.line2 || '',
          city: data.shippingAddress.city,
          postalCode: data.shippingAddress.postalCode,
          country: data.shippingAddress.country,
        },
      };

      const order = await createOrderMutation.mutateAsync({
        req: orderReq,
        idempotencyKey,
      });

      showToast({
        type: 'success',
        message: 'Order placed successfully!',
      });

      navigate(`/orders/${order.id}?placed=true`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.details) {
        err.details.forEach((d) => {
          if (d.field.startsWith('customer.')) {
            const field = d.field.replace('customer.', '') as 'name' | 'email';
            setError(`customer.${field}`, { message: d.message });
          } else if (d.field.startsWith('shippingAddress.')) {
            const field = d.field.replace('shippingAddress.', '') as
              'line1' | 'line2' | 'city' | 'postalCode' | 'country';
            setError(`shippingAddress.${field}`, { message: d.message });
          }
        });
      }
      const { message, requestId } = getUserErrorMessage(err);
      showToast({
        type: 'error',
        message: message || 'Failed to place order. Please check the form and try again.',
        requestId,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to cart
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-text mt-2">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <form
          id="checkout-form"
          onSubmit={handleSubmit(onSubmit)}
          className="lg:col-span-2 space-y-6"
          noValidate
        >
          {/* Customer Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-text pb-3 border-b border-border">
              1. Customer Information
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id={nameId} label="Full Name" required error={errors.customer?.name?.message}>
                <Input
                  id={nameId}
                  {...register('customer.name')}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.customer?.name)}
                />
              </Field>

              <Field
                id={emailId}
                label="Email Address"
                required
                error={errors.customer?.email?.message}
              >
                <Input
                  id={emailId}
                  type="email"
                  {...register('customer.email')}
                  placeholder="ada@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.customer?.email)}
                />
              </Field>
            </div>
          </Card>

          {/* Shipping Address */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-text pb-3 border-b border-border">
              2. Shipping Address
            </h2>
            <div className="mt-4 space-y-4">
              <Field
                id={line1Id}
                label="Street Address"
                required
                error={errors.shippingAddress?.line1?.message}
              >
                <Input
                  id={line1Id}
                  {...register('shippingAddress.line1')}
                  placeholder="1 Analytical Way"
                  autoComplete="address-line1"
                  aria-invalid={Boolean(errors.shippingAddress?.line1)}
                />
              </Field>

              <Field
                id={line2Id}
                label="Apartment, suite, etc. (optional)"
                error={errors.shippingAddress?.line2?.message}
              >
                <Input
                  id={line2Id}
                  {...register('shippingAddress.line2')}
                  placeholder="Suite 404"
                  autoComplete="address-line2"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  id={cityId}
                  label="City"
                  required
                  error={errors.shippingAddress?.city?.message}
                >
                  <Input
                    id={cityId}
                    {...register('shippingAddress.city')}
                    placeholder="San Francisco"
                    autoComplete="address-level2"
                    aria-invalid={Boolean(errors.shippingAddress?.city)}
                  />
                </Field>

                <Field
                  id={postalCodeId}
                  label="Postal / ZIP Code"
                  required
                  error={errors.shippingAddress?.postalCode?.message}
                >
                  <Input
                    id={postalCodeId}
                    {...register('shippingAddress.postalCode')}
                    placeholder="94107"
                    autoComplete="postal-code"
                    aria-invalid={Boolean(errors.shippingAddress?.postalCode)}
                  />
                </Field>

                <Field
                  id={countryId}
                  label="Country"
                  required
                  error={errors.shippingAddress?.country?.message}
                >
                  <Select
                    id={countryId}
                    {...register('shippingAddress.country')}
                    options={COUNTRIES}
                    aria-invalid={Boolean(errors.shippingAddress?.country)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Payment Method Notice */}
          <Card className="p-6 bg-surface-muted/50 border-dashed">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-success shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text">Test Mode Active</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  No payment required for this demo deployment. Placing your order will immediately
                  commit the order record to PostgreSQL.
                </p>
              </div>
            </div>
          </Card>
        </form>

        {/* Order Summary & Actions */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-20">
            <h2 className="text-lg font-bold text-text pb-4 border-b border-border">
              Order Items ({cart.itemCount})
            </h2>

            <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 py-1 text-sm">
                  <img
                    src={item.imageUrl || '/images/placeholder.svg'}
                    alt={item.name}
                    className="w-10 h-10 rounded border border-border object-cover bg-surface-muted shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">{item.name}</p>
                    <p className="text-xs text-text-muted">Qty: {item.quantity}</p>
                  </div>
                  <Money
                    priceCents={item.lineTotalCents}
                    className="font-medium text-text shrink-0"
                  />
                </div>
              ))}
            </div>

            <dl className="mt-6 pt-4 border-t border-border space-y-2 text-sm">
              <div className="flex items-center justify-between text-text-muted">
                <dt>Subtotal</dt>
                <dd>
                  <Money priceCents={cart.subtotalCents} className="font-medium text-text" />
                </dd>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <dt>Standard Shipping</dt>
                <dd className="text-success font-medium">Free</dd>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <dt>Taxes</dt>
                <dd className="font-mono text-xs">$0.00</dd>
              </div>
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <dt className="text-base font-bold text-text">Total Due</dt>
                <dd>
                  <Money
                    priceCents={cart.subtotalCents}
                    className="text-xl font-extrabold text-primary"
                  />
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <Button
                type="submit"
                form="checkout-form"
                variant="primary"
                size="lg"
                className="w-full gap-2"
                isLoading={isSubmitting || createOrderMutation.isPending}
                data-testid="place-order-btn"
              >
                <CheckCircle2 className="w-5 h-5" />
                Place Order
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-text-muted font-mono">
              Idempotency: {idempotencyKey.substring(0, 8)}...
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

import { http, HttpResponse } from 'msw';
import { mockCategories, mockProducts } from './fixtures';
import type { Cart, CartItem, Order, OrderRequest, Version } from '../api/types';

interface StoredCartItem {
  productId: string;
  quantity: number;
  addedAt: number;
}

const carts = new Map<string, StoredCartItem[]>();
const orders = new Map<string, Order[]>();
const idempotencyMap = new Map<string, Order>();

function getSessionCart(sessionId: string): Cart {
  const items = carts.get(sessionId) || [];
  let itemCount = 0;
  let subtotalCents = 0;

  const cartItems: CartItem[] = [];
  for (const item of items) {
    const prod = mockProducts.find((p) => p.id === item.productId);
    if (!prod) continue;
    const lineTotal = prod.priceCents * item.quantity;
    itemCount += item.quantity;
    subtotalCents += lineTotal;
    cartItems.push({
      productId: prod.id,
      name: prod.name,
      priceCents: prod.priceCents,
      quantity: item.quantity,
      lineTotalCents: lineTotal,
      imageUrl: prod.imageUrl,
    });
  }

  return {
    items: cartItems,
    itemCount,
    subtotalCents,
    currency: 'USD',
  };
}

export const handlers = [
  // Catalog
  http.get('/api/catalog/categories', () => {
    return HttpResponse.json({ items: mockCategories });
  }),

  http.get('/api/catalog/products', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

    let filtered = [...mockProducts];
    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (q) {
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return HttpResponse.json({ items, total });
  }),

  http.get('/api/catalog/products/:id', ({ params }) => {
    const { id } = params;
    const product = mockProducts.find((p) => p.id === id);
    if (!product) {
      return HttpResponse.json(
        {
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            requestId: 'mock-req-id',
          },
        },
        { status: 404 }
      );
    }
    return HttpResponse.json(product);
  }),

  // Versions
  http.get('/api/:service/version', ({ params }) => {
    const { service } = params;
    const versionResp: Version = {
      service: service as 'catalog' | 'cart' | 'orders',
      version: 'dev',
      gitSha: 'local',
      buildTime: '2026-11-20T09:58:00Z',
      environment: 'local',
      podName: `${service}-mock-pod`,
    };
    return HttpResponse.json(versionResp);
  }),

  // Cart
  http.get('/api/cart', ({ request }) => {
    const sessionId = request.headers.get('X-Session-ID');
    if (!sessionId) {
      return HttpResponse.json(
        {
          error: {
            code: 'MISSING_SESSION',
            message: 'Session required',
            requestId: 'mock-req-id',
          },
        },
        { status: 400 }
      );
    }
    return HttpResponse.json(getSessionCart(sessionId));
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const sessionId = request.headers.get('X-Session-ID');
    if (!sessionId) {
      return HttpResponse.json(
        {
          error: { code: 'MISSING_SESSION', message: 'Session required', requestId: 'mock-req-id' },
        },
        { status: 400 }
      );
    }
    const body = (await request.json()) as { productId?: string; quantity?: number };
    const productId = body.productId || '';
    const quantity = body.quantity || 1;

    const prod = mockProducts.find((p) => p.id === productId);
    if (!prod) {
      return HttpResponse.json(
        {
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            requestId: 'mock-req-id',
          },
        },
        { status: 404 }
      );
    }

    const items = carts.get(sessionId) || [];
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      if (existing.quantity + quantity > 20) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Max quantity 20',
              requestId: 'mock-req-id',
              details: [{ field: 'quantity', message: 'cannot exceed 20' }],
            },
          },
          { status: 400 }
        );
      }
      existing.quantity += quantity;
    } else {
      items.push({ productId, quantity, addedAt: Date.now() });
    }
    carts.set(sessionId, items);

    return HttpResponse.json(getSessionCart(sessionId));
  }),

  http.put('/api/cart/items/:productId', async ({ params, request }) => {
    const sessionId = request.headers.get('X-Session-ID');
    if (!sessionId) {
      return HttpResponse.json(
        {
          error: { code: 'MISSING_SESSION', message: 'Session required', requestId: 'mock-req-id' },
        },
        { status: 400 }
      );
    }
    const { productId } = params as { productId: string };
    const body = (await request.json()) as { quantity?: number };
    const quantity = body.quantity || 1;

    if (quantity < 1 || quantity > 20) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Quantity must be 1-20',
            requestId: 'mock-req-id',
            details: [{ field: 'quantity', message: 'must be 1-20' }],
          },
        },
        { status: 400 }
      );
    }

    const items = carts.get(sessionId) || [];
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity = quantity;
    } else {
      items.push({ productId, quantity, addedAt: Date.now() });
    }
    carts.set(sessionId, items);
    return HttpResponse.json(getSessionCart(sessionId));
  }),

  http.delete('/api/cart/items/:productId', ({ params, request }) => {
    const sessionId = request.headers.get('X-Session-ID');
    if (!sessionId) {
      return HttpResponse.json(
        {
          error: { code: 'MISSING_SESSION', message: 'Session required', requestId: 'mock-req-id' },
        },
        { status: 400 }
      );
    }
    const { productId } = params as { productId: string };
    const items = carts.get(sessionId) || [];
    carts.set(
      sessionId,
      items.filter((i) => i.productId !== productId)
    );
    return HttpResponse.json(getSessionCart(sessionId));
  }),

  http.delete('/api/cart', ({ request }) => {
    const sessionId = request.headers.get('X-Session-ID');
    if (sessionId) {
      carts.delete(sessionId);
    }
    return HttpResponse.json({
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      currency: 'USD',
    });
  }),

  // Orders
  http.get('/api/orders', ({ request }) => {
    const sessionId = request.headers.get('X-Session-ID') || 'default';
    const list = orders.get(sessionId) || [];
    return HttpResponse.json({ items: list });
  }),

  http.get('/api/orders/:id', ({ params, request }) => {
    const sessionId = request.headers.get('X-Session-ID') || 'default';
    const { id } = params;
    const list = orders.get(sessionId) || [];
    const order = list.find((o) => o.id === id);
    if (!order) {
      return HttpResponse.json(
        {
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found', requestId: 'mock-req-id' },
        },
        { status: 404 }
      );
    }
    return HttpResponse.json(order);
  }),

  http.post('/api/orders', async ({ request }) => {
    const sessionId = request.headers.get('X-Session-ID');
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!sessionId) {
      return HttpResponse.json(
        {
          error: { code: 'MISSING_SESSION', message: 'Session required', requestId: 'mock-req-id' },
        },
        { status: 400 }
      );
    }

    if (idempotencyKey) {
      const key = `${sessionId}:${idempotencyKey}`;
      const existing = idempotencyMap.get(key);
      if (existing) {
        return HttpResponse.json(existing, { status: 200 });
      }
    }

    const cart = getSessionCart(sessionId);
    if (cart.items.length === 0) {
      return HttpResponse.json(
        { error: { code: 'CART_EMPTY', message: 'Cart is empty', requestId: 'mock-req-id' } },
        { status: 422 }
      );
    }

    const body = (await request.json()) as OrderRequest;
    const orderId = '0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11';

    const order: Order = {
      id: orderId,
      status: 'PLACED',
      items: cart.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        priceCents: i.priceCents,
        quantity: i.quantity,
        lineTotalCents: i.lineTotalCents,
      })),
      totalCents: cart.subtotalCents,
      currency: 'USD',
      customer: body.customer,
      shippingAddress: body.shippingAddress,
      createdAt: new Date().toISOString(),
    };

    const sessionOrders = orders.get(sessionId) || [];
    sessionOrders.unshift(order);
    orders.set(sessionId, sessionOrders);

    if (idempotencyKey) {
      idempotencyMap.set(`${sessionId}:${idempotencyKey}`, order);
    }

    // Clear cart after placing order
    carts.delete(sessionId);

    return HttpResponse.json(order, { status: 201 });
  }),
];

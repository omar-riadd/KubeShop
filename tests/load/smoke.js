import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL,
  PRODUCTS,
  uuidv4,
  makeHeaders,
  randomCustomer,
  randomAddress,
} from './helpers.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'], // less than 1% failures
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
  },
};

export default function () {
  const sessionId = uuidv4();
  const headers = makeHeaders(sessionId);

  group('Catalog API Smoke Tests', () => {
    // 1. List products
    const listRes = http.get(`${BASE_URL}/api/catalog/products`, { headers });
    check(listRes, {
      'catalog list returns 200': (r) => r.status === 200,
      'catalog list has items': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items) && body.items.length === 12 && body.total === 12;
        } catch {
          return false;
        }
      },
    });

    // 2. Filter products by category
    const filterRes = http.get(`${BASE_URL}/api/catalog/products?category=keyboards`, { headers });
    check(filterRes, {
      'catalog category filter returns 200': (r) => r.status === 200,
      'catalog category items match': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.items.every((p) => p.category === 'keyboards');
        } catch {
          return false;
        }
      },
    });

    // 3. Categories list
    const catRes = http.get(`${BASE_URL}/api/catalog/categories`, { headers });
    check(catRes, {
      'categories returns 200': (r) => r.status === 200,
      'categories has 4 categories': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items) && body.items.length === 4;
        } catch {
          return false;
        }
      },
    });

    // 4. Product details
    const prodRes = http.get(`${BASE_URL}/api/catalog/products/kb-001`, { headers });
    check(prodRes, {
      'product detail returns 200': (r) => r.status === 200,
      'product id matches': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id === 'kb-001' && body.priceCents === 8900;
        } catch {
          return false;
        }
      },
    });

    // 5. Version
    const verRes = http.get(`${BASE_URL}/api/catalog/version`, { headers });
    check(verRes, {
      'catalog version returns 200': (r) => r.status === 200,
      'catalog version shape valid': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.service === 'catalog' && !!body.version;
        } catch {
          return false;
        }
      },
    });
  });

  group('Cart API Smoke Tests', () => {
    // 1. Initial cart should be empty
    const cartRes = http.get(`${BASE_URL}/api/cart`, { headers });
    check(cartRes, {
      'cart get returns 200': (r) => r.status === 200,
      'initial cart empty': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.itemCount === 0 && body.subtotalCents === 0;
        } catch {
          return false;
        }
      },
    });

    // 2. Add item to cart
    const addRes = http.post(
      `${BASE_URL}/api/cart/items`,
      JSON.stringify({ productId: 'kb-001', quantity: 2 }),
      { headers }
    );
    check(addRes, {
      'add to cart returns 200': (r) => r.status === 200,
      'cart reflects item added': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.itemCount === 2 && body.items.length === 1 && body.items[0].productId === 'kb-001';
        } catch {
          return false;
        }
      },
    });

    // 3. Update quantity
    const putRes = http.put(
      `${BASE_URL}/api/cart/items/kb-001`,
      JSON.stringify({ quantity: 3 }),
      { headers }
    );
    check(putRes, {
      'update cart item quantity returns 200': (r) => r.status === 200,
      'cart reflects quantity update': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.itemCount === 3 && body.items[0].quantity === 3;
        } catch {
          return false;
        }
      },
    });

    // 4. Cart version
    const cartVerRes = http.get(`${BASE_URL}/api/cart/version`, { headers });
    check(cartVerRes, {
      'cart version returns 200': (r) => r.status === 200,
      'cart version service name matches': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.service === 'cart';
        } catch {
          return false;
        }
      },
    });
  });

  group('Orders API Smoke Tests', () => {
    const idempotencyKey = uuidv4();
    const orderHeaders = Object.assign({}, headers, {
      'Idempotency-Key': idempotencyKey,
    });

    const orderPayload = JSON.stringify({
      customer: randomCustomer(),
      shippingAddress: randomAddress(),
    });

    // 1. Place order
    const orderRes = http.post(`${BASE_URL}/api/orders`, orderPayload, {
      headers: orderHeaders,
    });

    let createdOrderId = null;
    check(orderRes, {
      'order placement returns 201': (r) => r.status === 201,
      'order has id and PLACED status': (r) => {
        try {
          const body = JSON.parse(r.body);
          createdOrderId = body.id;
          return body.status === 'PLACED' && Array.isArray(body.items) && body.items.length > 0;
        } catch {
          return false;
        }
      },
    });

    // 2. Idempotent replay
    const replayRes = http.post(`${BASE_URL}/api/orders`, orderPayload, {
      headers: orderHeaders,
    });
    check(replayRes, {
      'idempotent order replay returns 200': (r) => r.status === 200,
      'replay matches created order id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id === createdOrderId;
        } catch {
          return false;
        }
      },
    });

    // 3. List orders for session
    const listOrdersRes = http.get(`${BASE_URL}/api/orders`, { headers });
    check(listOrdersRes, {
      'list orders returns 200': (r) => r.status === 200,
      'orders list contains created order': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items) && body.items.some((o) => o.id === createdOrderId);
        } catch {
          return false;
        }
      },
    });

    // 4. Get order by ID
    if (createdOrderId) {
      const getOrderRes = http.get(`${BASE_URL}/api/orders/${createdOrderId}`, { headers });
      check(getOrderRes, {
        'get order returns 200': (r) => r.status === 200,
        'order details match': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.id === createdOrderId && body.status === 'PLACED';
          } catch {
            return false;
          }
        },
      });
    }

    // 5. Orders version
    const ordersVerRes = http.get(`${BASE_URL}/api/orders/version`, { headers });
    check(ordersVerRes, {
      'orders version returns 200': (r) => r.status === 200,
      'orders version service name matches': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.service === 'orders';
        } catch {
          return false;
        }
      },
    });
  });

  sleep(0.5);
}

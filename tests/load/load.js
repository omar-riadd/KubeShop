import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  PRODUCTS,
  CATEGORIES,
  uuidv4,
  makeHeaders,
  sample,
  randomCustomer,
  randomAddress,
} from './helpers.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 25 },  // Ramp up to normal load (25 users)
    { duration: '2m', target: 25 },  // Sustained load
    { duration: '30s', target: 0 },  // Graceful ramp-down
  ],
  thresholds: {
    // SLO constraints from plan.md §14
    http_req_failed: ['rate<0.01'],    // Error rate must stay below 1%
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete in < 500ms
  },
};

export default function () {
  const sessionId = uuidv4();
  const headers = makeHeaders(sessionId);

  // 1. Browsing catalog (100% of visitors)
  const listRes = http.get(`${BASE_URL}/api/catalog/products`, { headers });
  check(listRes, { 'catalog list status 200': (r) => r.status === 200 });
  sleep(Math.random() * 1.5 + 0.5);

  // 2. Fetch categories (70% of visitors)
  if (Math.random() < 0.7) {
    const catRes = http.get(`${BASE_URL}/api/catalog/categories`, { headers });
    check(catRes, { 'categories status 200': (r) => r.status === 200 });

    const selectedCategory = sample(CATEGORIES);
    const filterRes = http.get(
      `${BASE_URL}/api/catalog/products?category=${selectedCategory}`,
      { headers }
    );
    check(filterRes, { 'filter category status 200': (r) => r.status === 200 });
    sleep(Math.random() * 1.5 + 0.5);
  }

  // 3. View product details (60% of visitors)
  const productId = sample(PRODUCTS);
  if (Math.random() < 0.6) {
    const prodRes = http.get(`${BASE_URL}/api/catalog/products/${productId}`, { headers });
    check(prodRes, { 'product detail status 200': (r) => r.status === 200 });
    sleep(Math.random() * 1.5 + 0.5);
  }

  // 4. Add item to cart (40% of visitors)
  let hasCart = false;
  if (Math.random() < 0.4) {
    const qty = Math.floor(Math.random() * 2) + 1;
    const addRes = http.post(
      `${BASE_URL}/api/cart/items`,
      JSON.stringify({ productId, quantity: qty }),
      { headers }
    );
    check(addRes, { 'cart add status 200': (r) => r.status === 200 });
    hasCart = true;
    sleep(Math.random() * 1.0 + 0.5);

    // Review cart
    const cartRes = http.get(`${BASE_URL}/api/cart`, { headers });
    check(cartRes, { 'cart view status 200': (r) => r.status === 200 });
    sleep(Math.random() * 1.0 + 0.5);
  }

  // 5. Checkout & place order (15% of visitors with items in cart)
  if (hasCart && Math.random() < 0.35) {
    const orderHeaders = Object.assign({}, headers, {
      'Idempotency-Key': uuidv4(),
    });

    const orderPayload = JSON.stringify({
      customer: randomCustomer(),
      shippingAddress: randomAddress(),
    });

    const orderRes = http.post(`${BASE_URL}/api/orders`, orderPayload, {
      headers: orderHeaders,
    });
    check(orderRes, {
      'order placement status 201 or 200': (r) => r.status === 201 || r.status === 200,
    });
    sleep(Math.random() * 1.0 + 0.5);

    // View order list
    const ordersRes = http.get(`${BASE_URL}/api/orders`, { headers });
    check(ordersRes, { 'orders list status 200': (r) => r.status === 200 });
  }

  // 6. Background platform status check (simulates SPA header/status polling)
  if (Math.random() < 0.2) {
    const verRes = http.get(`${BASE_URL}/api/catalog/version`, { headers });
    check(verRes, { 'version probe status 200': (r) => r.status === 200 });
  }

  sleep(Math.random() * 2.0 + 1.0);
}

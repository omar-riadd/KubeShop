import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  PRODUCTS,
  uuidv4,
  makeHeaders,
  sample,
  randomCustomer,
  randomAddress,
} from './helpers.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Warm-up to 20 users
    { duration: '1m', target: 60 },   // Ramp up to 60 users (triggers HPA CPU scaling > 70%)
    { duration: '1m', target: 120 },  // Peak stress spike (triggers KEDA orders queue / max pods)
    { duration: '30s', target: 160 }, // Maximum stress
    { duration: '1m', target: 20 },   // Scale-down recovery observation
    { duration: '30s', target: 0 },   // Teardown
  ],
  thresholds: {
    // Under extreme stress we monitor availability and degradation limits
    http_req_failed: ['rate<0.05'],     // Failures must stay under 5% even under peak load
    http_req_duration: ['p(95)<1500'],  // 95% latency should remain under 1500ms
  },
};

export default function () {
  const sessionId = uuidv4();
  const headers = makeHeaders(sessionId);

  // Fast burst browsing
  const listRes = http.get(`${BASE_URL}/api/catalog/products`, { headers });
  check(listRes, { 'catalog list ok': (r) => r.status === 200 });

  const productId = sample(PRODUCTS);
  const detailRes = http.get(`${BASE_URL}/api/catalog/products/${productId}`, { headers });
  check(detailRes, { 'product detail ok': (r) => r.status === 200 });

  // Rapid cart add & checkout to stress Redis and Postgres
  if (Math.random() < 0.6) {
    const addRes = http.post(
      `${BASE_URL}/api/cart/items`,
      JSON.stringify({ productId, quantity: 1 }),
      { headers }
    );
    check(addRes, { 'cart add ok': (r) => r.status === 200 });

    if (Math.random() < 0.5) {
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
        'order placed ok': (r) => r.status === 201 || r.status === 200,
      });
    }
  }

  // Short pause to maintain high request throughput
  sleep(Math.random() * 0.4 + 0.1);
}

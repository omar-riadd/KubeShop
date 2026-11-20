CREATE TABLE orders (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  idempotency_key uuid,
  status text NOT NULL DEFAULT 'PLACED',
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  ship_line1 text NOT NULL,
  ship_line2 text NOT NULL DEFAULT '',
  ship_city text NOT NULL,
  ship_postal_code text NOT NULL,
  ship_country char(2) NOT NULL,
  currency char(3) NOT NULL,
  total_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, idempotency_key)
);

CREATE TABLE order_items (
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  name text NOT NULL,
  price_cents integer NOT NULL,
  quantity integer NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX orders_session_created_idx ON orders (session_id, created_at DESC);

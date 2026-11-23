ALTER TABLE orders
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE orders SET updated_at = created_at;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'));

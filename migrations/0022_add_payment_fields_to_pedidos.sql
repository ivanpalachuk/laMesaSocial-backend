ALTER TABLE pedidos ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE pedidos ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE pedidos ADD COLUMN payment_preference_id TEXT;
ALTER TABLE pedidos ADD COLUMN payment_id TEXT;
ALTER TABLE pedidos ADD COLUMN payment_init_point TEXT;
ALTER TABLE pedidos ADD COLUMN payment_last_payload TEXT;

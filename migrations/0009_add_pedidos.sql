CREATE TABLE pedidos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal INTEGER NOT NULL,
  shipping_cost INTEGER NOT NULL DEFAULT 2500,
  total INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_city TEXT NOT NULL DEFAULT 'Mar del Plata',
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pedido_items (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

CREATE INDEX idx_pedidos_user ON pedidos(user_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);

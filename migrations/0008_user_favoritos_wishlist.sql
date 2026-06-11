CREATE TABLE user_favoritos (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, producto_id)
);

CREATE TABLE user_wishlist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, producto_id)
);

CREATE INDEX idx_user_favoritos_user ON user_favoritos(user_id);
CREATE INDEX idx_user_wishlist_user ON user_wishlist(user_id);

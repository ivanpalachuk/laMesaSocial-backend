import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  canEditArticles: integer("can_edit_articles", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  avatarImageKey: text("avatar_image_key"),
  avatarImageKeys: text("avatar_image_keys").notNull().default("[]"),
  avatarPreset: text("avatar_preset"),
  bio: text("bio"),
  gamerDna: text("gamer_dna").notNull().default("[]"),
  discoveryZone: text("discovery_zone"),
  notifyEvents: integer("notify_events", { mode: "boolean" }).notNull().default(true),
  notifyGroupInvites: integer("notify_group_invites", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const encuentros = sqliteTable("encuentros", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  menuLudico: text("menu_ludico"),
  menuLudicoProductoIds: text("menu_ludico_producto_ids").notNull().default("[]"),
  menuPrecios: text("menu_precios").notNull().default("[]"),
  location: text("location").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  maxSeats: integer("max_seats").notNull().default(20),
  availableSeats: integer("available_seats").notNull().default(20),
  pricePerPerson: integer("price_per_person").notNull().default(20000),
  imageKey: text("image_key"),
  galleryImageKeys: text("gallery_image_keys").notNull().default("[]"),
  status: text("status", { enum: ["draft", "published", "cancelled"] })
    .notNull()
    .default("published"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const encuentroComments = sqliteTable("encuentro_comments", {
  id: text("id").primaryKey(),
  encuentroId: text("encuentro_id")
    .notNull()
    .references(() => encuentros.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  moderationNote: text("moderation_note"),
  moderatedBy: text("moderated_by").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: integer("moderated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const productos = sqliteTable("productos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  categories: text("categories").notNull().default('["otros"]'),
  condition: text("condition", { enum: ["nuevo", "como_nuevo", "usado"] })
    .notNull()
    .default("nuevo"),
  minPlayers: integer("min_players").notNull().default(2),
  maxPlayers: integer("max_players").notNull().default(4),
  minAge: integer("min_age").notNull().default(8),
  estimatedMinutes: integer("estimated_minutes").notNull().default(60),
  difficulty: real("difficulty").notNull().default(1.0),
  publisher: text("publisher"),
  price: integer("price").notNull().default(0),
  stock: integer("stock").notNull().default(1),
  imageKey: text("image_key"),
  imageKeys: text("image_keys").notNull().default("[]"),
  status: text("status", { enum: ["available", "sold_out", "draft"] })
    .notNull()
    .default("available"),
  enLudoteca: integer("en_ludoteca", { mode: "boolean" }).notNull().default(false),
  esFavorito: integer("es_favorito", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const encyclopediaArticles = sqliteTable("encyclopedia_articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  topic: text("topic").notNull().default("general"),
  relatedProductoIds: text("related_producto_ids").notNull().default("[]"),
  imageKey: text("image_key"),
  imageKeys: text("image_keys").notNull().default("[]"),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const userFavoritos = sqliteTable(
  "user_favoritos",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productoId: text("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.productoId] }),
  }),
);

export const userWishlist = sqliteTable(
  "user_wishlist",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productoId: text("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.productoId] }),
  }),
);

export const pedidos = sqliteTable("pedidos", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["pending", "confirmed", "cancelled", "fulfilled"] })
    .notNull()
    .default("pending"),
  subtotal: integer("subtotal").notNull(),
  shippingCost: integer("shipping_cost").notNull().default(2500),
  total: integer("total").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  shippingCity: text("shipping_city").notNull().default("Mar del Plata"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pedidoItems = sqliteTable("pedido_items", {
  id: text("id").primaryKey(),
  pedidoId: text("pedido_id")
    .notNull()
    .references(() => pedidos.id, { onDelete: "cascade" }),
  productoId: text("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
  encuentros: many(encuentros),
  encuentroComments: many(encuentroComments),
  favoritos: many(userFavoritos),
  wishlist: many(userWishlist),
  pedidos: many(pedidos),
  encyclopediaArticles: many(encyclopediaArticles),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const encuentrosRelations = relations(encuentros, ({ one, many }) => ({
  creator: one(users, {
    fields: [encuentros.createdBy],
    references: [users.id],
  }),
  comments: many(encuentroComments),
}));

export const encyclopediaArticlesRelations = relations(encyclopediaArticles, ({ one }) => ({
  creator: one(users, {
    fields: [encyclopediaArticles.createdBy],
    references: [users.id],
  }),
}));

export const encuentroCommentsRelations = relations(encuentroComments, ({ one }) => ({
  encuentro: one(encuentros, {
    fields: [encuentroComments.encuentroId],
    references: [encuentros.id],
  }),
  user: one(users, {
    fields: [encuentroComments.userId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [encuentroComments.moderatedBy],
    references: [users.id],
  }),
}));

export const userFavoritosRelations = relations(userFavoritos, ({ one }) => ({
  user: one(users, { fields: [userFavoritos.userId], references: [users.id] }),
  producto: one(productos, { fields: [userFavoritos.productoId], references: [productos.id] }),
}));

export const userWishlistRelations = relations(userWishlist, ({ one }) => ({
  user: one(users, { fields: [userWishlist.userId], references: [users.id] }),
  producto: one(productos, { fields: [userWishlist.productoId], references: [productos.id] }),
}));

export const pedidosRelations = relations(pedidos, ({ one, many }) => ({
  user: one(users, { fields: [pedidos.userId], references: [users.id] }),
  items: many(pedidoItems),
}));

export const pedidoItemsRelations = relations(pedidoItems, ({ one }) => ({
  pedido: one(pedidos, { fields: [pedidoItems.pedidoId], references: [pedidos.id] }),
  producto: one(productos, { fields: [pedidoItems.productoId], references: [productos.id] }),
}));

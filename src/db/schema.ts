import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
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

export const encuentros = sqliteTable("encuentros", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  maxSeats: integer("max_seats").notNull().default(20),
  availableSeats: integer("available_seats").notNull().default(20),
  pricePerPerson: integer("price_per_person").notNull().default(20000),
  imageKey: text("image_key"),
  status: text("status", { enum: ["draft", "published", "cancelled"] })
    .notNull()
    .default("published"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const productos = sqliteTable("productos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("otros"),
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

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  encuentros: many(encuentros),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const encuentrosRelations = relations(encuentros, ({ one }) => ({
  creator: one(users, {
    fields: [encuentros.createdBy],
    references: [users.id],
  }),
}));

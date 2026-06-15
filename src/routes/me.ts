import { Hono, type Context } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createDbClient } from "../db";
import { productos, userFavoritos, userWishlist, users } from "../db/schema";
import { authMiddleware, type AppEnv } from "../middleware/auth";
import {
  appendAvatarImageKey,
  filterOwnedAvatarKeys,
  isAvatarKeyOwnedByUser,
  isAvatarPresetId,
  parseAvatarImageKeys,
  serializeAvatarImageKeys,
  serializeGamerDna,
  serializeUserProfile,
} from "../utils/user-profile";

const meRoutes = new Hono<AppEnv>();

type MeContext = Context<AppEnv>;
type UserLibraryTable = typeof userFavoritos | typeof userWishlist;

const DEFAULT_CATEGORIES = ["otros"];

function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const categories = parsed.map((item) => item.trim()).filter(Boolean);
      return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CATEGORIES;
}

function buildImageUrl(origin: string, imageKey: string | null) {
  if (!imageKey) return null;
  const encoded = imageKey.split("/").map(encodeURIComponent).join("/");
  return `${origin}/api/images/${encoded}`;
}

function withImageUrl(origin: string, row: typeof productos.$inferSelect) {
  const { categories: rawCategories, ...rest } = row;
  return {
    ...rest,
    categories: parseCategories(rawCategories),
    imageUrl: buildImageUrl(origin, row.imageKey),
  };
}

async function getProductoOr404(db: ReturnType<typeof createDbClient>, productoId: string) {
  return db.select().from(productos).where(eq(productos.id, productoId)).get();
}

function createListHandlers(table: UserLibraryTable) {
  return {
    listIds: async (c: MeContext) => {
      const db = createDbClient(c.env.DB);
      const userId = c.get("userId");
      const rows = await db
        .select({ productoId: table.productoId })
        .from(table)
        .where(eq(table.userId, userId))
        .all();
      return c.json({ productoIds: rows.map((row) => row.productoId) });
    },

    listProductos: async (c: MeContext) => {
      const db = createDbClient(c.env.DB);
      const origin = new URL(c.req.url).origin;
      const userId = c.get("userId");
      const links = await db
        .select({ productoId: table.productoId })
        .from(table)
        .where(eq(table.userId, userId))
        .orderBy(desc(table.createdAt))
        .all();

      if (!links.length) {
        return c.json({ productos: [] });
      }

      const ids = links.map((link) => link.productoId);
      const rows = await db.select().from(productos).where(inArray(productos.id, ids)).all();
      const byId = new Map(rows.map((row) => [row.id, row]));
      const productosList = ids
        .map((id) => byId.get(id))
        .filter((row): row is typeof productos.$inferSelect => Boolean(row))
        .map((row) => withImageUrl(origin, row));

      return c.json({ productos: productosList });
    },

    toggle: async (c: MeContext) => {
      const db = createDbClient(c.env.DB);
      const userId = c.get("userId");
      const productoId = c.req.param("productoId");
      if (!productoId) {
        return c.json({ error: "Producto id required" }, 400);
      }

      const producto = await getProductoOr404(db, productoId);
      if (!producto) {
        return c.json({ error: "Producto not found" }, 404);
      }

      const existing = await db
        .select()
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.productoId, productoId)))
        .get();

      if (existing) {
        await db
          .delete(table)
          .where(and(eq(table.userId, userId), eq(table.productoId, productoId)))
          .run();
        return c.json({ active: false, productoId });
      }

      await db
        .insert(table)
        .values({
          userId,
          productoId,
          createdAt: new Date(),
        })
        .run();

      return c.json({ active: true, productoId });
    },

    sync: async (c: MeContext) => {
      const db = createDbClient(c.env.DB);
      const userId = c.get("userId");
      const body = await c.req.json<{ productoIds?: string[] }>();
      const incoming = Array.from(
        new Set((body.productoIds ?? []).filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
      );

      if (!incoming.length) {
        return c.json({ added: 0, productoIds: [] });
      }

      const validRows = await db
        .select({ id: productos.id })
        .from(productos)
        .where(inArray(productos.id, incoming))
        .all();
      const validIds = new Set(validRows.map((row) => row.id));

      const existingRows = await db
        .select({ productoId: table.productoId })
        .from(table)
        .where(eq(table.userId, userId))
        .all();
      const existingIds = new Set(existingRows.map((row) => row.productoId));

      const toAdd = incoming.filter((id) => validIds.has(id) && !existingIds.has(id));
      const now = new Date();

      for (const productoId of toAdd) {
        await db.insert(table).values({ userId, productoId, createdAt: now }).run();
      }

      return c.json({ added: toAdd.length, productoIds: toAdd });
    },
  };
}

const favoritosHandlers = createListHandlers(userFavoritos);
const wishlistHandlers = createListHandlers(userWishlist);

meRoutes.use("*", authMiddleware);

meRoutes.get("/favoritos/ids", favoritosHandlers.listIds);
meRoutes.get("/favoritos", favoritosHandlers.listProductos);
meRoutes.put("/favoritos/:productoId", favoritosHandlers.toggle);
meRoutes.post("/favoritos/sync", favoritosHandlers.sync);

meRoutes.get("/wishlist/ids", wishlistHandlers.listIds);
meRoutes.get("/wishlist", wishlistHandlers.listProductos);
meRoutes.put("/wishlist/:productoId", wishlistHandlers.toggle);
meRoutes.post("/wishlist/sync", wishlistHandlers.sync);

meRoutes.get("/profile", async (c: MeContext) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user || !user.isActive) {
    return c.json({ error: "User not found" }, 404);
  }

  const origin = new URL(c.req.url).origin;
  const profile = await serializeUserProfile(origin, user, c.env.IMAGES);
  const sanitizedKeys = profile.avatarImageKeys;
  const storedKeys = parseAvatarImageKeys(user.avatarImageKeys);
  const storedSerialized = serializeAvatarImageKeys(storedKeys);
  const sanitizedSerialized = serializeAvatarImageKeys(sanitizedKeys);
  const activeKeyChanged = user.avatarImageKey !== profile.avatarImageKey;

  if (sanitizedSerialized !== storedSerialized || activeKeyChanged) {
    await db
      .update(users)
      .set({
        avatarImageKeys: sanitizedSerialized,
        avatarImageKey: profile.avatarImageKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .run();
  }

  return c.json({ profile });
});

meRoutes.patch("/profile", async (c: MeContext) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const body = await c.req.json<{
    name?: string;
    bio?: string | null;
    gamerDna?: string[];
    discoveryZone?: string | null;
    notifyEvents?: boolean;
    notifyGroupInvites?: boolean;
    avatarPreset?: string | null;
    avatarImageKey?: string | null;
  }>();

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  const existing = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!existing || !existing.isActive) {
    return c.json({ error: "User not found" }, 404);
  }

  let nextAvatarImageKeys = parseAvatarImageKeys(existing.avatarImageKeys);

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return c.json({ error: "Name is required" }, 400);
    }
    updates.name = name;
  }

  if (body.bio !== undefined) {
    updates.bio = body.bio?.trim().slice(0, 500) || null;
  }

  if (body.gamerDna !== undefined) {
    if (!Array.isArray(body.gamerDna)) {
      return c.json({ error: "Invalid gamerDna" }, 400);
    }
    updates.gamerDna = serializeGamerDna(body.gamerDna);
  }

  if (body.discoveryZone !== undefined) {
    updates.discoveryZone = body.discoveryZone?.trim() || null;
  }

  if (body.notifyEvents !== undefined) {
    updates.notifyEvents = Boolean(body.notifyEvents);
  }

  if (body.notifyGroupInvites !== undefined) {
    updates.notifyGroupInvites = Boolean(body.notifyGroupInvites);
  }

  if (body.avatarPreset !== undefined) {
    if (body.avatarPreset === null) {
      updates.avatarPreset = null;
    } else if (!isAvatarPresetId(body.avatarPreset)) {
      return c.json({ error: "Invalid avatar preset" }, 400);
    } else {
      if (existing.avatarImageKey) {
        nextAvatarImageKeys = appendAvatarImageKey(nextAvatarImageKeys, existing.avatarImageKey);
      }
      nextAvatarImageKeys = await filterOwnedAvatarKeys(c.env.IMAGES, userId, nextAvatarImageKeys);
      updates.avatarImageKeys = serializeAvatarImageKeys(nextAvatarImageKeys);
      updates.avatarPreset = body.avatarPreset;
      updates.avatarImageKey = null;
    }
  }

  if (body.avatarImageKey !== undefined) {
    if (body.avatarImageKey === null) {
      updates.avatarImageKey = null;
    } else {
      const key = body.avatarImageKey.trim();
      if (!key.startsWith("avatars/")) {
        return c.json({ error: "Invalid avatar key" }, 400);
      }

      const ownsKey = await isAvatarKeyOwnedByUser(c.env.IMAGES, userId, key);
      if (!ownsKey) {
        return c.json({ error: "Invalid avatar key" }, 403);
      }

      nextAvatarImageKeys = appendAvatarImageKey(nextAvatarImageKeys, key);
      nextAvatarImageKeys = await filterOwnedAvatarKeys(c.env.IMAGES, userId, nextAvatarImageKeys);
      updates.avatarImageKeys = serializeAvatarImageKeys(nextAvatarImageKeys);
      updates.avatarImageKey = key;
      updates.avatarPreset = null;
    }
  }

  await db.update(users).set(updates).where(eq(users.id, userId)).run();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const origin = new URL(c.req.url).origin;
  return c.json({ profile: await serializeUserProfile(origin, user, c.env.IMAGES) });
});

export default meRoutes;

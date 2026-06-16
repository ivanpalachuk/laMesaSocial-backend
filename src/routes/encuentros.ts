import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { createDbClient } from "../db";
import { encuentroComments, encuentros, users } from "../db/schema";
import { adminOnly, authMiddleware, type AppEnv } from "../middleware/auth";
import { scheduleNewEventNotifications } from "../utils/event-notifications";
import { generateId } from "../utils/jwt";
import { buildAvatarUrl } from "../utils/user-profile";

const encuentrosRoutes = new Hono<AppEnv>();

const COMMENT_MAX_LENGTH = 600;

function buildImageUrl(origin: string, imageKey: string | null) {
  if (!imageKey) {
    return null;
  }

  const encoded = imageKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${origin}/api/images/${encoded}`;
}

function parseMenuLudicoProductoIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function serializeMenuLudicoProductoIds(ids: string[] | undefined): string {
  if (!Array.isArray(ids)) return "[]";
  const normalized = ids.map((item) => item.trim()).filter(Boolean);
  return JSON.stringify(normalized);
}

type MenuPrecioItem = {
  id: string;
  name: string;
  price: number;
  category?: string;
};

function parseMenuPrecios(raw: string | null | undefined): MenuPrecioItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
      .map((item) => ({
        id: typeof item.id === "string" ? item.id.trim() : "",
        name: typeof item.name === "string" ? item.name.trim() : "",
        price: typeof item.price === "number" ? item.price : Number(item.price),
        category:
          typeof item.category === "string" && item.category.trim()
            ? item.category.trim()
            : undefined,
      }))
      .filter((item) => item.id && item.name && Number.isFinite(item.price) && item.price >= 0);
  } catch {
    return [];
  }
}

function serializeMenuPrecios(items: MenuPrecioItem[] | undefined): string {
  if (!Array.isArray(items)) return "[]";
  const normalized = items
    .map((item) => ({
      id: item.id.trim(),
      name: item.name.trim(),
      price: item.price,
      ...(item.category?.trim() ? { category: item.category.trim() } : {}),
    }))
    .filter((item) => item.id && item.name && Number.isFinite(item.price) && item.price >= 0);
  return JSON.stringify(normalized);
}

function parseGalleryImageKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function serializeGalleryImageKeys(keys: string[] | undefined): string {
  if (!Array.isArray(keys)) return "[]";
  const normalized = keys.map((item) => item.trim()).filter(Boolean);
  return JSON.stringify(normalized);
}

function withImageUrl(origin: string, row: typeof encuentros.$inferSelect) {
  const menuLudicoProductoIds = parseMenuLudicoProductoIds(row.menuLudicoProductoIds);
  const menuPrecios = parseMenuPrecios(row.menuPrecios);
  const galleryImageKeys = parseGalleryImageKeys(row.galleryImageKeys);
  const galleryImageUrls = galleryImageKeys
    .map((key) => buildImageUrl(origin, key))
    .filter((url): url is string => Boolean(url));
  return {
    ...row,
    menuLudicoProductoIds,
    menuPrecios,
    galleryImageKeys,
    galleryImageUrls,
    imageUrl: buildImageUrl(origin, row.imageKey),
  };
}

function normalizeCommentContent(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function toPublicComment(
  origin: string,
  row: {
    id: string;
    encuentroId: string;
    userId: string;
    content: string;
    status: "pending" | "approved" | "rejected";
    moderationNote: string | null;
    moderatedBy: string | null;
    moderatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    authorName: string;
    authorAvatarKey: string | null;
  },
) {
  return {
    id: row.id,
    encuentroId: row.encuentroId,
    userId: row.userId,
    content: row.content,
    status: row.status,
    moderationNote: row.moderationNote,
    moderatedBy: row.moderatedBy,
    moderatedAt: row.moderatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      id: row.userId,
      name: row.authorName,
      avatarUrl: buildAvatarUrl(origin, row.authorAvatarKey),
    },
  };
}

encuentrosRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db
    .select()
    .from(encuentros)
    .where(eq(encuentros.status, "published"))
    .orderBy(desc(encuentros.startsAt))
    .all();

  return c.json({ encuentros: rows.map((row) => withImageUrl(origin, row)) });
});

encuentrosRoutes.get("/comments/pending", authMiddleware, adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;

  const rows = await db
    .select({
      id: encuentroComments.id,
      encuentroId: encuentroComments.encuentroId,
      userId: encuentroComments.userId,
      content: encuentroComments.content,
      status: encuentroComments.status,
      moderationNote: encuentroComments.moderationNote,
      moderatedBy: encuentroComments.moderatedBy,
      moderatedAt: encuentroComments.moderatedAt,
      createdAt: encuentroComments.createdAt,
      updatedAt: encuentroComments.updatedAt,
      authorName: users.name,
      authorAvatarKey: users.avatarImageKey,
      encuentroTitle: encuentros.title,
    })
    .from(encuentroComments)
    .innerJoin(users, eq(users.id, encuentroComments.userId))
    .innerJoin(encuentros, eq(encuentros.id, encuentroComments.encuentroId))
    .where(eq(encuentroComments.status, "pending"))
    .orderBy(desc(encuentroComments.createdAt))
    .all();

  return c.json({
    comments: rows.map((row) => ({
      ...toPublicComment(origin, row),
      encuentroTitle: row.encuentroTitle,
    })),
  });
});

encuentrosRoutes.get("/admin/all", authMiddleware, async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db.select().from(encuentros).orderBy(desc(encuentros.startsAt)).all();

  return c.json({ encuentros: rows.map((row) => withImageUrl(origin, row)) });
});

encuentrosRoutes.get("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const id = c.req.param("id");

  const encuentro = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!encuentro) {
    return c.json({ error: "Encuentro not found" }, 404);
  }

  return c.json({ encuentro: withImageUrl(origin, encuentro) });
});

encuentrosRoutes.get("/:id/comments", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const encuentroId = c.req.param("id");

  const encuentro = await db.select({ id: encuentros.id }).from(encuentros).where(eq(encuentros.id, encuentroId)).get();
  if (!encuentro) {
    return c.json({ error: "Encuentro not found" }, 404);
  }

  const rows = await db
    .select({
      id: encuentroComments.id,
      encuentroId: encuentroComments.encuentroId,
      userId: encuentroComments.userId,
      content: encuentroComments.content,
      status: encuentroComments.status,
      moderationNote: encuentroComments.moderationNote,
      moderatedBy: encuentroComments.moderatedBy,
      moderatedAt: encuentroComments.moderatedAt,
      createdAt: encuentroComments.createdAt,
      updatedAt: encuentroComments.updatedAt,
      authorName: users.name,
      authorAvatarKey: users.avatarImageKey,
    })
    .from(encuentroComments)
    .innerJoin(users, eq(users.id, encuentroComments.userId))
    .where(and(eq(encuentroComments.encuentroId, encuentroId), eq(encuentroComments.status, "approved")))
    .orderBy(desc(encuentroComments.createdAt))
    .all();

  return c.json({ comments: rows.map((row) => toPublicComment(origin, row)) });
});

encuentrosRoutes.use("*", authMiddleware);

encuentrosRoutes.get("/:id/comments/mine", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const encuentroId = c.req.param("id");
  const userId = c.get("userId");

  const rows = await db
    .select({
      id: encuentroComments.id,
      encuentroId: encuentroComments.encuentroId,
      userId: encuentroComments.userId,
      content: encuentroComments.content,
      status: encuentroComments.status,
      moderationNote: encuentroComments.moderationNote,
      moderatedBy: encuentroComments.moderatedBy,
      moderatedAt: encuentroComments.moderatedAt,
      createdAt: encuentroComments.createdAt,
      updatedAt: encuentroComments.updatedAt,
      authorName: users.name,
      authorAvatarKey: users.avatarImageKey,
    })
    .from(encuentroComments)
    .innerJoin(users, eq(users.id, encuentroComments.userId))
    .where(and(eq(encuentroComments.encuentroId, encuentroId), eq(encuentroComments.userId, userId)))
    .orderBy(desc(encuentroComments.createdAt))
    .all();

  return c.json({ comments: rows.map((row) => toPublicComment(origin, row)) });
});

encuentrosRoutes.post("/:id/comments", async (c) => {
  const db = createDbClient(c.env.DB);
  const encuentroId = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json<{ content?: string }>();

  const encuentro = await db.select({ id: encuentros.id }).from(encuentros).where(eq(encuentros.id, encuentroId)).get();
  if (!encuentro) {
    return c.json({ error: "Encuentro not found" }, 404);
  }

  const content = normalizeCommentContent(body.content);
  if (!content) {
    return c.json({ error: "Comment content is required" }, 400);
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    return c.json({ error: `Comment exceeds ${COMMENT_MAX_LENGTH} characters` }, 400);
  }

  const now = new Date();
  const newComment = {
    id: generateId(),
    encuentroId,
    userId,
    content,
    status: "pending" as const,
    moderationNote: null,
    moderatedBy: null,
    moderatedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(encuentroComments).values(newComment).run();

  const author = await db
    .select({ name: users.name, avatarImageKey: users.avatarImageKey })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return c.json(
    {
      comment: toPublicComment(new URL(c.req.url).origin, {
        ...newComment,
        authorName: author?.name ?? "Usuario",
        authorAvatarKey: author?.avatarImageKey ?? null,
      }),
    },
    201,
  );
});

encuentrosRoutes.patch("/comments/:commentId/moderate", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const commentId = c.req.param("commentId");
  const moderatorId = c.get("userId");
  const body = await c.req.json<{ status?: "approved" | "rejected"; moderationNote?: string | null }>();

  if (!commentId) {
    return c.json({ error: "Comment id is required" }, 400);
  }

  if (!body.status || !["approved", "rejected"].includes(body.status)) {
    return c.json({ error: "Invalid moderation status" }, 400);
  }

  const existing = await db
    .select({ id: encuentroComments.id, status: encuentroComments.status })
    .from(encuentroComments)
    .where(eq(encuentroComments.id, commentId))
    .get();

  if (!existing) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const moderationNote = body.moderationNote?.trim() || null;
  const now = new Date();

  await db
    .update(encuentroComments)
    .set({
      status: body.status,
      moderationNote,
      moderatedBy: moderatorId,
      moderatedAt: now,
      updatedAt: now,
    })
    .where(eq(encuentroComments.id, commentId))
    .run();

  const updated = await db
    .select({
      id: encuentroComments.id,
      encuentroId: encuentroComments.encuentroId,
      userId: encuentroComments.userId,
      content: encuentroComments.content,
      status: encuentroComments.status,
      moderationNote: encuentroComments.moderationNote,
      moderatedBy: encuentroComments.moderatedBy,
      moderatedAt: encuentroComments.moderatedAt,
      createdAt: encuentroComments.createdAt,
      updatedAt: encuentroComments.updatedAt,
      authorName: users.name,
      authorAvatarKey: users.avatarImageKey,
    })
    .from(encuentroComments)
    .innerJoin(users, eq(users.id, encuentroComments.userId))
    .where(eq(encuentroComments.id, commentId))
    .get();

  if (!updated) {
    return c.json({ error: "Comment not found" }, 404);
  }

  return c.json({ comment: toPublicComment(new URL(c.req.url).origin, updated) });
});

encuentrosRoutes.post("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const body = await c.req.json<{
    title: string;
    description?: string;
    menuLudico?: string;
    menuLudicoProductoIds?: string[];
    menuPrecios?: MenuPrecioItem[];
    location: string;
    startsAt: string;
    endsAt?: string;
    maxSeats?: number;
    availableSeats?: number;
    pricePerPerson?: number;
    imageKey?: string;
    galleryImageKeys?: string[];
    status?: "draft" | "published" | "cancelled";
  }>();

  if (!body.title || !body.location || !body.startsAt) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;

  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    return c.json({ error: "Invalid date format" }, 400);
  }

  const maxSeats = body.maxSeats ?? 20;
  const availableSeats = body.availableSeats ?? maxSeats;
  const pricePerPerson = body.pricePerPerson ?? 20000;
  if (maxSeats <= 0 || availableSeats < 0 || availableSeats > maxSeats) {
    return c.json({ error: "Invalid seats values" }, 400);
  }
  if (pricePerPerson < 0) {
    return c.json({ error: "Invalid pricePerPerson value" }, 400);
  }

  const now = new Date();
  const newEncuentro = {
    id: generateId(),
    title: body.title,
    description: body.description ?? null,
    menuLudico: body.menuLudico?.trim() || null,
    menuLudicoProductoIds: serializeMenuLudicoProductoIds(body.menuLudicoProductoIds),
    menuPrecios: serializeMenuPrecios(body.menuPrecios),
    location: body.location,
    startsAt,
    endsAt,
    maxSeats,
    availableSeats,
    pricePerPerson,
    imageKey: body.imageKey ?? null,
    galleryImageKeys: serializeGalleryImageKeys(body.galleryImageKeys),
    status: body.status ?? "published",
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(encuentros).values(newEncuentro).run();

  if (newEncuentro.status === "published") {
    scheduleNewEventNotifications(c, db, {
      id: newEncuentro.id,
      title: newEncuentro.title,
      location: newEncuentro.location,
      startsAt: newEncuentro.startsAt,
    });
  }

  const origin = new URL(c.req.url).origin;
  return c.json({ encuentro: withImageUrl(origin, newEncuentro) }, 201);
});

encuentrosRoutes.patch("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    description?: string | null;
    menuLudico?: string | null;
    menuLudicoProductoIds?: string[];
    menuPrecios?: MenuPrecioItem[];
    location?: string;
    startsAt?: string;
    endsAt?: string | null;
    maxSeats?: number;
    availableSeats?: number;
    pricePerPerson?: number;
    imageKey?: string | null;
    galleryImageKeys?: string[];
    status?: "draft" | "published" | "cancelled";
  }>();

  const existing = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!existing) {
    return c.json({ error: "Encuentro not found" }, 404);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.menuLudico !== undefined) {
    patch.menuLudico = body.menuLudico?.trim() || null;
  }
  if (body.menuLudicoProductoIds !== undefined) {
    patch.menuLudicoProductoIds = serializeMenuLudicoProductoIds(body.menuLudicoProductoIds);
  }
  if (body.menuPrecios !== undefined) {
    patch.menuPrecios = serializeMenuPrecios(body.menuPrecios);
  }
  if (body.location !== undefined) patch.location = body.location;
  if (body.startsAt !== undefined) {
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) return c.json({ error: "Invalid startsAt date" }, 400);
    patch.startsAt = startsAt;
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt === null) {
      patch.endsAt = null;
    } else {
      const endsAt = new Date(body.endsAt);
      if (Number.isNaN(endsAt.getTime())) return c.json({ error: "Invalid endsAt date" }, 400);
      patch.endsAt = endsAt;
    }
  }
  if (body.maxSeats !== undefined) patch.maxSeats = body.maxSeats;
  if (body.availableSeats !== undefined) patch.availableSeats = body.availableSeats;
  if (body.pricePerPerson !== undefined) {
    if (body.pricePerPerson < 0) {
      return c.json({ error: "Invalid pricePerPerson value" }, 400);
    }
    patch.pricePerPerson = body.pricePerPerson;
  }
  if (body.imageKey !== undefined) {
    patch.imageKey = body.imageKey;
  }
  if (body.galleryImageKeys !== undefined) {
    patch.galleryImageKeys = serializeGalleryImageKeys(body.galleryImageKeys);
  }
  if (body.status !== undefined) patch.status = body.status;

  await db.update(encuentros).set(patch).where(eq(encuentros.id, id)).run();

  const updated = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!updated) {
    return c.json({ error: "Encuentro not found" }, 404);
  }

  const becamePublished =
    updated.status === "published" && existing.status !== "published";

  if (becamePublished) {
    scheduleNewEventNotifications(c, db, {
      id: updated.id,
      title: updated.title,
      location: updated.location,
      startsAt: updated.startsAt,
    });
  }

  return c.json({ encuentro: withImageUrl(new URL(c.req.url).origin, updated) });
});

encuentrosRoutes.delete("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!existing) {
    return c.json({ error: "Encuentro not found" }, 404);
  }

  await db.delete(encuentros).where(eq(encuentros.id, id)).run();
  return c.json({ message: "Encuentro deleted" });
});

export default encuentrosRoutes;

import { Hono } from "hono";
import { and, asc, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { createDbClient } from "../db";
import { homeBanners } from "../db/schema";
import { adminOnly, authMiddleware, type AppEnv } from "../middleware/auth";
import { generateId } from "../utils/jwt";

const homeBannersRoutes = new Hono<AppEnv>();

function buildImageUrl(origin: string, imageKey: string) {
  const encoded = imageKey.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${origin}/api/images/${encoded}`;
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  return text.length <= maxLength ? text : undefined;
}

function parseCtaHref(value: unknown): string | null | undefined {
  const href = optionalText(value, 500);
  if (href === undefined || href === null) return href;
  if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) return href;
  try {
    return new URL(href).protocol === "https:" ? href : undefined;
  } catch {
    return undefined;
  }
}

function serializeBanner(origin: string, banner: typeof homeBanners.$inferSelect) {
  return {
    ...banner,
    imageUrl: buildImageUrl(origin, banner.imageKey),
    startsAt: banner.startsAt?.toISOString() ?? null,
    expiresAt: banner.expiresAt?.toISOString() ?? null,
    createdAt: banner.createdAt.toISOString(),
    updatedAt: banner.updatedAt.toISOString(),
  };
}

function validateCta(ctaLabel: string | null | undefined, ctaHref: string | null | undefined) {
  return Boolean(ctaLabel) === Boolean(ctaHref);
}

homeBannersRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const now = new Date();
  const rows = await db
    .select()
    .from(homeBanners)
    .where(and(
      eq(homeBanners.isActive, true),
      or(isNull(homeBanners.startsAt), lte(homeBanners.startsAt, now)),
      or(isNull(homeBanners.expiresAt), gt(homeBanners.expiresAt, now)),
    ))
    .orderBy(asc(homeBanners.sortOrder), desc(homeBanners.updatedAt))
    .all();

  return c.json({ banners: rows.map((banner) => serializeBanner(new URL(c.req.url).origin, banner)) });
});

homeBannersRoutes.get("/admin", authMiddleware, adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const rows = await db.select().from(homeBanners).orderBy(asc(homeBanners.sortOrder), desc(homeBanners.updatedAt)).all();
  return c.json({ banners: rows.map((banner) => serializeBanner(new URL(c.req.url).origin, banner)) });
});

homeBannersRoutes.post("/admin", authMiddleware, adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<Record<string, unknown>>();
  const title = optionalText(body.title, 120);
  const eyebrow = optionalText(body.eyebrow, 80);
  const description = optionalText(body.description, 360);
  const imageKey = optionalText(body.imageKey, 500);
  const ctaLabel = optionalText(body.ctaLabel, 60);
  const ctaHref = parseCtaHref(body.ctaHref);
  const startsAt = parseOptionalDate(body.startsAt);
  const expiresAt = parseOptionalDate(body.expiresAt);
  const sortOrder = body.sortOrder === undefined ? 0 : Number(body.sortOrder);

  if (!title || !imageKey) return c.json({ error: "Título e imagen son obligatorios" }, 400);
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return c.json({ error: "Estado inválido" }, 400);
  }
  if (
    (body.eyebrow !== undefined && eyebrow === undefined)
    || (body.description !== undefined && description === undefined)
    || (body.ctaLabel !== undefined && ctaLabel === undefined)
    || (body.ctaHref !== undefined && ctaHref === undefined)
  ) {
    return c.json({ error: "Contenido del banner inválido" }, 400);
  }
  if (body.startsAt !== undefined && startsAt === undefined) return c.json({ error: "Inicio de vigencia inválido" }, 400);
  if (body.expiresAt !== undefined && expiresAt === undefined) return c.json({ error: "Vencimiento inválido" }, 400);
  if (startsAt && expiresAt && startsAt >= expiresAt) return c.json({ error: "La vigencia es inválida" }, 400);
  if (!validateCta(ctaLabel, ctaHref)) return c.json({ error: "El texto y el enlace del botón deben completarse juntos" }, 400);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100_000) return c.json({ error: "Orden inválido" }, 400);

  const now = new Date();
  const id = generateId();
  await db.insert(homeBanners).values({
    id, title, eyebrow: eyebrow ?? null, description: description ?? null, imageKey,
    ctaLabel: ctaLabel ?? null, ctaHref: ctaHref ?? null, startsAt: startsAt ?? null, expiresAt: expiresAt ?? null,
    isActive: body.isActive !== false, sortOrder, createdBy: c.get("userId"), createdAt: now, updatedAt: now,
  }).run();
  const banner = await db.select().from(homeBanners).where(eq(homeBanners.id, id)).get();
  return c.json({ banner: banner ? serializeBanner(new URL(c.req.url).origin, banner) : null }, 201);
});

homeBannersRoutes.patch("/admin/:id", authMiddleware, adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Banner no encontrado" }, 404);
  const existing = await db.select().from(homeBanners).where(eq(homeBanners.id, id)).get();
  if (!existing) return c.json({ error: "Banner no encontrado" }, 404);

  const body = await c.req.json<Record<string, unknown>>();
  const patch: Partial<typeof homeBanners.$inferInsert> = { updatedAt: new Date() };
  const title = optionalText(body.title, 120);
  const eyebrow = optionalText(body.eyebrow, 80);
  const description = optionalText(body.description, 360);
  const imageKey = optionalText(body.imageKey, 500);
  const ctaLabel = optionalText(body.ctaLabel, 60);
  const ctaHref = parseCtaHref(body.ctaHref);
  const startsAt = parseOptionalDate(body.startsAt);
  const expiresAt = parseOptionalDate(body.expiresAt);

  if (body.title !== undefined && !title) return c.json({ error: "Título inválido" }, 400);
  if (body.imageKey !== undefined && !imageKey) return c.json({ error: "Imagen inválida" }, 400);
  if (
    (body.eyebrow !== undefined && eyebrow === undefined)
    || (body.description !== undefined && description === undefined)
    || (body.ctaLabel !== undefined && ctaLabel === undefined)
    || (body.ctaHref !== undefined && ctaHref === undefined)
  ) {
    return c.json({ error: "Contenido del banner inválido" }, 400);
  }
  if (body.startsAt !== undefined && startsAt === undefined) return c.json({ error: "Inicio de vigencia inválido" }, 400);
  if (body.expiresAt !== undefined && expiresAt === undefined) return c.json({ error: "Vencimiento inválido" }, 400);

  if (title) patch.title = title;
  if (eyebrow !== undefined) patch.eyebrow = eyebrow;
  if (description !== undefined) patch.description = description;
  if (imageKey) patch.imageKey = imageKey;
  if (ctaLabel !== undefined) patch.ctaLabel = ctaLabel;
  if (ctaHref !== undefined) patch.ctaHref = ctaHref;
  if (startsAt !== undefined) patch.startsAt = startsAt;
  if (expiresAt !== undefined) patch.expiresAt = expiresAt;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return c.json({ error: "Estado inválido" }, 400);
    patch.isActive = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100_000) return c.json({ error: "Orden inválido" }, 400);
    patch.sortOrder = sortOrder;
  }

  const nextStartsAt = patch.startsAt instanceof Date || patch.startsAt === null ? patch.startsAt : existing.startsAt;
  const nextExpiresAt = patch.expiresAt instanceof Date || patch.expiresAt === null ? patch.expiresAt : existing.expiresAt;
  if (nextStartsAt && nextExpiresAt && nextStartsAt >= nextExpiresAt) return c.json({ error: "La vigencia es inválida" }, 400);
  const nextCtaLabel = patch.ctaLabel !== undefined ? patch.ctaLabel : existing.ctaLabel;
  const nextCtaHref = patch.ctaHref !== undefined ? patch.ctaHref : existing.ctaHref;
  if (!validateCta(nextCtaLabel, nextCtaHref)) return c.json({ error: "El texto y el enlace del botón deben completarse juntos" }, 400);

  await db.update(homeBanners).set(patch).where(eq(homeBanners.id, id)).run();
  const banner = await db.select().from(homeBanners).where(eq(homeBanners.id, id)).get();
  return c.json({ banner: banner ? serializeBanner(new URL(c.req.url).origin, banner) : null });
});

homeBannersRoutes.delete("/admin/:id", authMiddleware, adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Banner no encontrado" }, 404);
  const existing = await db.select().from(homeBanners).where(eq(homeBanners.id, id)).get();
  if (!existing) return c.json({ error: "Banner no encontrado" }, 404);
  await db.delete(homeBanners).where(eq(homeBanners.id, id)).run();
  return c.body(null, 204);
});

export default homeBannersRoutes;

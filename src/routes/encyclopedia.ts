import { Hono, type Context } from "hono";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { createDbClient } from "../db";
import { encyclopediaArticles, productos } from "../db/schema";
import { adminOnly, authMiddleware, type AppEnv } from "../middleware/auth";
import { generateId } from "../utils/jwt";

const encyclopediaRoutes = new Hono<AppEnv>();

type ArticleStatus = "draft" | "published";
type ArticleSortField = "createdAt" | "title" | "topic";
type SortOrder = "asc" | "desc";

type WorkersAiImageResponse = {
  image?: string;
};

const TOPICS = ["general", "mecanicas", "guias"] as const;

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function parseSortBy(value: string | undefined, fallback: ArticleSortField): ArticleSortField {
  if (value === "title" || value === "topic" || value === "createdAt") return value;
  return fallback;
}

function parseSortOrder(value: string | undefined, fallback: SortOrder): SortOrder {
  if (value === "asc" || value === "desc") return value;
  return fallback;
}

function getSortColumn(sortBy: ArticleSortField) {
  if (sortBy === "title") return encyclopediaArticles.title;
  if (sortBy === "topic") return encyclopediaArticles.topic;
  return encyclopediaArticles.createdAt;
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    /* ignore invalid JSON */
  }
  return [];
}

function serializeStringArray(values: string[] | undefined): string {
  return JSON.stringify((values ?? []).map((item) => item.trim()).filter(Boolean));
}

function normalizeImageKeysInput(
  imageKeys: string[] | undefined,
  imageKey: string | null | undefined,
): string[] {
  if (Array.isArray(imageKeys)) return imageKeys.map((item) => item.trim()).filter(Boolean);
  if (imageKey === null) return [];
  if (typeof imageKey === "string" && imageKey.trim()) return [imageKey.trim()];
  return [];
}

function buildImageUrl(origin: string, imageKey: string | null) {
  if (!imageKey) return null;
  const encoded = imageKey.split("/").map(encodeURIComponent).join("/");
  return `${origin}/api/images/${encoded}`;
}

function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    /* ignore invalid JSON */
  }
  return [];
}

function withProductoImageUrl(origin: string, row: typeof productos.$inferSelect) {
  const imageKeys = parseJsonStringArray(row.imageKeys);
  const resolvedImageKeys = imageKeys.length ? imageKeys : row.imageKey ? [row.imageKey] : [];
  const imageUrls = resolvedImageKeys
    .map((key) => buildImageUrl(origin, key))
    .filter((url): url is string => Boolean(url));

  return {
    id: row.id,
    title: row.title,
    categories: parseCategories(row.categories),
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    estimatedMinutes: row.estimatedMinutes,
    difficulty: row.difficulty,
    price: row.price,
    stock: row.stock,
    status: row.status,
    enLudoteca: row.enLudoteca,
    imageUrl: imageUrls[0] ?? null,
  };
}

async function getRelatedProductos(
  db: ReturnType<typeof createDbClient>,
  origin: string,
  productoIds: string[],
) {
  const ids = [...new Set(productoIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return [];

  const rows = await db.select().from(productos).where(inArray(productos.id, ids)).all();
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids
    .map((id) => byId.get(id))
    .filter((row): row is typeof productos.$inferSelect => Boolean(row))
    .map((row) => withProductoImageUrl(origin, row));
}

function withImageUrl(origin: string, row: typeof encyclopediaArticles.$inferSelect) {
  const imageKeys = parseJsonStringArray(row.imageKeys);
  const resolvedImageKeys = imageKeys.length ? imageKeys : row.imageKey ? [row.imageKey] : [];
  const imageUrls = resolvedImageKeys
    .map((key) => buildImageUrl(origin, key))
    .filter((url): url is string => Boolean(url));

  return {
    ...row,
    relatedProductoIds: parseJsonStringArray(row.relatedProductoIds),
    imageKeys: resolvedImageKeys,
    imageUrls,
    imageKey: resolvedImageKeys[0] ?? null,
    imageUrl: imageUrls[0] ?? null,
  };
}

function parsePagination(c: Context<AppEnv>, defaultPageSize: number) {
  return {
    page: parsePositiveInt(c.req.query("page"), 1),
    pageSize: Math.min(parsePositiveInt(c.req.query("pageSize"), defaultPageSize), 100),
    sortBy: parseSortBy(c.req.query("sortBy"), "createdAt"),
    sortOrder: parseSortOrder(c.req.query("sortOrder"), "desc"),
  };
}

function listWhere(filters: { q?: string; topic?: string; status?: ArticleStatus }): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(encyclopediaArticles.status, filters.status));
  if (filters.topic) clauses.push(eq(encyclopediaArticles.topic, filters.topic));
  if (filters.q) {
    const term = `%${filters.q.toLowerCase()}%`;
    clauses.push(or(
      sql`lower(${encyclopediaArticles.title}) like ${term}`,
      sql`lower(${encyclopediaArticles.summary}) like ${term}`,
      sql`lower(${encyclopediaArticles.content}) like ${term}`,
    )!);
  }
  if (!clauses.length) return undefined;
  return and(...clauses);
}

async function queryArticles(
  db: ReturnType<typeof createDbClient>,
  origin: string,
  filters: { q?: string; topic?: string; status?: ArticleStatus },
  pagination: ReturnType<typeof parsePagination>,
) {
  const whereClause = listWhere(filters);
  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(encyclopediaArticles)
    .where(whereClause)
    .get();
  const total = Number(totalRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  const safePage = Math.min(pagination.page, totalPages);

  const rows = await db
    .select()
    .from(encyclopediaArticles)
    .where(whereClause)
    .orderBy(
      pagination.sortOrder === "asc"
        ? asc(getSortColumn(pagination.sortBy))
        : desc(getSortColumn(pagination.sortBy)),
    )
    .limit(pagination.pageSize)
    .offset((safePage - 1) * pagination.pageSize)
    .all();

  return {
    articles: rows.map((row) => withImageUrl(origin, row)),
    pagination: { page: safePage, pageSize: pagination.pageSize, total, totalPages },
    sorting: { sortBy: pagination.sortBy, sortOrder: pagination.sortOrder },
  };
}

function normalizeTopic(topic: string | undefined) {
  const value = topic?.trim() || "general";
  return TOPICS.includes(value as (typeof TOPICS)[number]) ? value : "general";
}

function validateArticleInput(body: { title?: string; summary?: string; content?: string }) {
  if (!body.title?.trim()) return "Title is required";
  if (!body.summary?.trim()) return "Summary is required";
  if (!body.content?.trim()) return "Content is required";
  return null;
}

function buildArticleImagePrompt(input: { title: string; summary: string; content: string; topic: string }) {
  return [
    "Genera una imagen horizontal 16:9 para una enciclopedia de juegos de mesa de La Mesa Social.",
    "Estilo: fotografia editorial calida y realista, componentes de juegos modernos sobre una mesa, manos aprendiendo o comparando piezas, ambiente cercano.",
    "Marca: marron tierra #5d4037, naranja #f57c00, fondo claro #fbf9f5 y acentos teal #005049. Evitar estética de casino o marcas registradas.",
    "Composicion: clara, educativa, con espacio limpio para texto superpuesto. No generar texto legible, logos ni tableros registrados reconocibles.",
    `Tema: ${input.topic}.`,
    `Titulo: ${input.title.trim()}.`,
    `Resumen: ${input.summary.trim()}.`,
    `Contenido de referencia: ${input.content.trim().slice(0, 1200)}.`,
  ].join("\n");
}

encyclopediaRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const result = await queryArticles(
    db,
    origin,
    {
      q: c.req.query("q")?.trim() || undefined,
      topic: c.req.query("topic")?.trim() || undefined,
      status: "published",
    },
    parsePagination(c, 12),
  );
  return c.json(result);
});

encyclopediaRoutes.get("/topics", (c) => c.json({ topics: TOPICS }));

encyclopediaRoutes.get("/admin/all", authMiddleware, adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const status = c.req.query("status") as ArticleStatus | undefined;
  const result = await queryArticles(
    db,
    origin,
    {
      q: c.req.query("q")?.trim() || undefined,
      topic: c.req.query("topic")?.trim() || undefined,
      status: status === "draft" || status === "published" ? status : undefined,
    },
    parsePagination(c, 20),
  );
  return c.json(result);
});

encyclopediaRoutes.get("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const row = await db
    .select()
    .from(encyclopediaArticles)
    .where(eq(encyclopediaArticles.id, c.req.param("id")))
    .get();
  if (!row || row.status !== "published") return c.json({ error: "Article not found" }, 404);
  const article = withImageUrl(origin, row);
  const relatedProductos = await getRelatedProductos(db, origin, article.relatedProductoIds);
  return c.json({ article: { ...article, relatedProductos } });
});

encyclopediaRoutes.use("*", authMiddleware, adminOnly);

encyclopediaRoutes.post("/generate-image", async (c) => {
  const body = await c.req.json<{ title?: string; summary?: string; content?: string; topic?: string }>();
  const validationError = validateArticleInput(body);
  if (validationError) return c.json({ error: validationError }, 400);

  let response: WorkersAiImageResponse;
  try {
    response = (await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: buildArticleImagePrompt({
        title: body.title!,
        summary: body.summary!,
        content: body.content!,
        topic: normalizeTopic(body.topic),
      }),
    })) as WorkersAiImageResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Workers AI error";
    return c.json({ error: `Workers AI failed: ${message}` }, 502);
  }

  if (!response.image) return c.json({ error: "Workers AI returned no image" }, 502);
  return c.json({ image: { data: response.image, mimeType: "image/jpeg" } });
});

encyclopediaRoutes.post("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const body = await c.req.json<{
    title?: string;
    summary?: string;
    content?: string;
    topic?: string;
    relatedProductoIds?: string[];
    imageKey?: string | null;
    imageKeys?: string[];
    status?: ArticleStatus;
  }>();

  const validationError = validateArticleInput(body);
  if (validationError) return c.json({ error: validationError }, 400);

  const now = new Date();
  const imageKeys = normalizeImageKeysInput(body.imageKeys, body.imageKey);
  const row = {
    id: generateId(),
    title: body.title!.trim(),
    summary: body.summary!.trim(),
    content: body.content!.trim(),
    topic: normalizeTopic(body.topic),
    relatedProductoIds: serializeStringArray(body.relatedProductoIds),
    imageKey: imageKeys[0] ?? null,
    imageKeys: serializeStringArray(imageKeys),
    status: (body.status === "published" ? "published" : "draft") as ArticleStatus,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(encyclopediaArticles).values(row).run();
  return c.json({ article: withImageUrl(new URL(c.req.url).origin, row) }, 201);
});

encyclopediaRoutes.patch("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(encyclopediaArticles)
    .where(eq(encyclopediaArticles.id, id))
    .get();
  if (!existing) return c.json({ error: "Article not found" }, 404);

  const body = await c.req.json<Partial<{
    title: string;
    summary: string;
    content: string;
    topic: string;
    relatedProductoIds: string[];
    imageKey: string | null;
    imageKeys: string[];
    status: ArticleStatus;
  }>>();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.summary !== undefined) patch.summary = body.summary.trim();
  if (body.content !== undefined) patch.content = body.content.trim();
  if (body.topic !== undefined) patch.topic = normalizeTopic(body.topic);
  if (body.relatedProductoIds !== undefined) patch.relatedProductoIds = serializeStringArray(body.relatedProductoIds);
  if (body.imageKeys !== undefined || body.imageKey !== undefined) {
    const imageKeys = normalizeImageKeysInput(body.imageKeys, body.imageKey);
    patch.imageKeys = serializeStringArray(imageKeys);
    patch.imageKey = imageKeys[0] ?? null;
  }
  if (body.status !== undefined) patch.status = body.status;

  await db.update(encyclopediaArticles).set(patch).where(eq(encyclopediaArticles.id, id)).run();
  const updated = await db
    .select()
    .from(encyclopediaArticles)
    .where(eq(encyclopediaArticles.id, id))
    .get();
  return c.json({ article: withImageUrl(new URL(c.req.url).origin, updated!) });
});

encyclopediaRoutes.delete("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  const existing = await db
    .select({ id: encyclopediaArticles.id })
    .from(encyclopediaArticles)
    .where(eq(encyclopediaArticles.id, id))
    .get();
  if (!existing) return c.json({ error: "Article not found" }, 404);

  await db.delete(encyclopediaArticles).where(eq(encyclopediaArticles.id, id)).run();
  return c.json({ message: "Article deleted" });
});

export default encyclopediaRoutes;

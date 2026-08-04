import { Hono, type Context } from "hono";
import { and, asc, desc, eq, gt, lte, or, sql, type SQL } from "drizzle-orm";
import { createDbClient } from "../db";
import { productos } from "../db/schema";
import { adminOnly, authMiddleware, type AppEnv } from "../middleware/auth";
import { generateId } from "../utils/jwt";
import { priceMultiplierFromPercentage } from "../utils/price-adjustment";

const productosRoutes = new Hono<AppEnv>();

type ProductoCondition = "nuevo" | "como_nuevo" | "usado";
type ProductoStatus = "available" | "draft";
type ProductoSortField =
  | "createdAt"
  | "title"
  | "price"
  | "stock"
  | "category"
  | "difficulty"
  | "estimatedMinutes";
type DurationBand = "short" | "medium" | "long";
type DifficultyBand = "easy" | "medium" | "hard";
type SortOrder = "asc" | "desc";

const DEFAULT_CATEGORIES = ["otros"];

function getSortColumn(sortBy: ProductoSortField) {
  switch (sortBy) {
    case "title":
      return productos.title;
    case "price":
      return productos.price;
    case "stock":
      return productos.stock;
    case "category":
      return sql`json_extract(${productos.categories}, '$[0]')`;
    case "difficulty":
      return productos.difficulty;
    case "estimatedMinutes":
      return productos.estimatedMinutes;
    case "createdAt":
    default:
      return productos.createdAt;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function parseSortBy(value: string | undefined, fallback: ProductoSortField): ProductoSortField {
  if (!value) return fallback;
  const allowed: ProductoSortField[] = [
    "createdAt",
    "title",
    "price",
    "stock",
    "category",
    "difficulty",
    "estimatedMinutes",
  ];
  if (allowed.includes(value as ProductoSortField)) return value as ProductoSortField;
  return fallback;
}

function parseSortOrder(value: string | undefined, fallback: SortOrder): SortOrder {
  if (value === "asc" || value === "desc") return value;
  return fallback;
}

function parseBooleanQuery(value: string | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseOptionalInt(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function parseCategoriesQuery(c: Context<AppEnv>): string[] {
  const repeated = c.req.queries("categories") ?? c.req.queries("category") ?? [];
  const combined = c.req.query("categories") ?? c.req.query("category") ?? "";
  const fromCsv = combined
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set([...repeated, ...fromCsv]));
}

function buildCategoriesFilter(categories: string[]): SQL | undefined {
  if (!categories.length) return undefined;
  const clauses = categories.map(
    (category) =>
      sql`EXISTS (SELECT 1 FROM json_each(${productos.categories}) WHERE value = ${category})`,
  );
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

type ProductListFilters = {
  q?: string;
  categories?: string[];
  status?: ProductoStatus;
  enLudoteca?: boolean | null;
  esFavorito?: boolean | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  maxPrice?: number | null;
  durationBand?: DurationBand;
  difficultyBand?: DifficultyBand;
  storeOnly?: boolean;
  availableOnly?: boolean;
  outOfStockOnly?: boolean;
};

function parseDurationBand(value: string | undefined): DurationBand | undefined {
  if (value === "short" || value === "medium" || value === "long") return value;
  return undefined;
}

function parseDifficultyBand(value: string | undefined): DifficultyBand | undefined {
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return undefined;
}

function parseProductoStatus(value: unknown): ProductoStatus | undefined {
  if (value === "available" || value === "draft") return value;
  return undefined;
}

function buildProductListWhere(filters: ProductListFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (filters.availableOnly) {
    clauses.push(eq(productos.status, "available"));
    clauses.push(gt(productos.stock, 0));
  } else if (filters.status) {
    clauses.push(eq(productos.status, filters.status));
  }

  if (filters.outOfStockOnly) {
    clauses.push(eq(productos.status, "available"));
    clauses.push(lte(productos.stock, 0));
  }

  if (filters.storeOnly) {
    clauses.push(eq(productos.status, "available"));
    clauses.push(gt(productos.stock, 0));
    clauses.push(eq(productos.enLudoteca, false));
  }

  if (filters.q) {
    clauses.push(sql`lower(${productos.title}) like ${`%${filters.q.toLowerCase()}%`}`);
  }

  const categoryFilter = buildCategoriesFilter(filters.categories ?? []);
  if (categoryFilter) clauses.push(categoryFilter);

  if (filters.enLudoteca !== null && filters.enLudoteca !== undefined) {
    clauses.push(eq(productos.enLudoteca, filters.enLudoteca));
  }

  if (filters.esFavorito !== null && filters.esFavorito !== undefined) {
    clauses.push(eq(productos.esFavorito, filters.esFavorito));
  }

  if (filters.minPlayers !== null && filters.minPlayers !== undefined) {
    clauses.push(sql`${productos.maxPlayers} >= ${filters.minPlayers}`);
  }

  if (filters.maxPlayers !== null && filters.maxPlayers !== undefined) {
    clauses.push(sql`${productos.minPlayers} <= ${filters.maxPlayers}`);
  }

  if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
    clauses.push(lte(productos.price, filters.maxPrice));
  }

  if (filters.durationBand === "short") {
    clauses.push(lte(productos.estimatedMinutes, 45));
  } else if (filters.durationBand === "medium") {
    clauses.push(gt(productos.estimatedMinutes, 45));
    clauses.push(lte(productos.estimatedMinutes, 90));
  } else if (filters.durationBand === "long") {
    clauses.push(gt(productos.estimatedMinutes, 90));
  }

  if (filters.difficultyBand === "easy") {
    clauses.push(lte(productos.difficulty, 2));
  } else if (filters.difficultyBand === "medium") {
    clauses.push(gt(productos.difficulty, 2));
    clauses.push(lte(productos.difficulty, 3.5));
  } else if (filters.difficultyBand === "hard") {
    clauses.push(gt(productos.difficulty, 3.5));
  }

  if (!clauses.length) return undefined;
  return and(...clauses);
}

async function queryProductList(
  db: ReturnType<typeof createDbClient>,
  origin: string,
  filters: ProductListFilters,
  pagination: { page: number; pageSize: number; sortBy: ProductoSortField; sortOrder: SortOrder },
  includeCost = false,
) {
  const whereClause = buildProductListWhere(filters);

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(productos)
    .where(whereClause)
    .get();
  const total = Number(totalRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  const safePage = Math.min(pagination.page, totalPages);
  const offset = (safePage - 1) * pagination.pageSize;

  const rows = await db
    .select()
    .from(productos)
    .where(whereClause)
    .orderBy(
      pagination.sortOrder === "asc"
        ? asc(getSortColumn(pagination.sortBy))
        : desc(getSortColumn(pagination.sortBy)),
    )
    .limit(pagination.pageSize)
    .offset(offset)
    .all();

  return {
    productos: rows.map((r) => withImageUrl(origin, r, includeCost)),
    pagination: {
      page: safePage,
      pageSize: pagination.pageSize,
      total,
      totalPages,
    },
    sorting: {
      sortBy: pagination.sortBy,
      sortOrder: pagination.sortOrder,
    },
  };
}

function parseListPagination(c: Context<AppEnv>, defaultPageSize: number) {
  return {
    page: parsePositiveInt(c.req.query("page"), 1),
    pageSize: Math.min(parsePositiveInt(c.req.query("pageSize"), defaultPageSize), 100),
    sortBy: parseSortBy(c.req.query("sortBy"), "createdAt"),
    sortOrder: parseSortOrder(c.req.query("sortOrder"), "desc"),
  };
}

function parseListFilters(c: Context<AppEnv>): ProductListFilters {
  const q = (c.req.query("q") ?? "").trim();
  const rawStatus = (c.req.query("status") ?? "").trim();
  const status = parseProductoStatus(rawStatus);
  return {
    q: q || undefined,
    categories: parseCategoriesQuery(c),
    status: status || undefined,
    outOfStockOnly: rawStatus === "sold_out",
    enLudoteca: parseBooleanQuery(c.req.query("enLudoteca")),
    esFavorito: parseBooleanQuery(c.req.query("esFavorito")),
    minPlayers: parseOptionalInt(c.req.query("minPlayers")),
    maxPlayers: parseOptionalInt(c.req.query("maxPlayers")),
    maxPrice: parseOptionalInt(c.req.query("maxPrice")),
    durationBand: parseDurationBand(c.req.query("durationBand")),
    difficultyBand: parseDifficultyBand(c.req.query("difficultyBand")),
    storeOnly: parseBooleanQuery(c.req.query("storeOnly")) === true,
  };
}

function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const categories = parsed.map((item) => item.trim()).filter(Boolean);
      return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
    }
  } catch {
    /* ignore invalid JSON */
  }
  return DEFAULT_CATEGORIES;
}

function serializeCategories(categories: string[]): string {
  const normalized = categories.map((item) => item.trim()).filter(Boolean);
  return JSON.stringify(normalized.length > 0 ? normalized : DEFAULT_CATEGORIES);
}

function normalizeCategoriesInput(input: string | string[] | undefined): string[] {
  if (Array.isArray(input)) {
    const categories = input.map((item) => item.trim()).filter(Boolean);
    return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  }
  if (typeof input === "string" && input.trim()) {
    return [input.trim()];
  }
  return DEFAULT_CATEGORIES;
}

function buildImageUrl(origin: string, imageKey: string | null) {
  if (!imageKey) return null;
  const encoded = imageKey.split("/").map(encodeURIComponent).join("/");
  return `${origin}/api/images/${encoded}`;
}

function parseImageKeys(raw: string | null | undefined, legacyKey: string | null): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const keys = parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
        if (keys.length > 0) return keys;
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  if (legacyKey?.trim()) return [legacyKey.trim()];
  return [];
}

function serializeImageKeys(keys: string[]): string {
  const normalized = keys.map((item) => item.trim()).filter(Boolean);
  return JSON.stringify(normalized);
}

function normalizeImageKeysInput(
  imageKeys: string[] | undefined,
  imageKey: string | null | undefined,
): string[] {
  if (Array.isArray(imageKeys)) {
    return imageKeys.map((item) => item.trim()).filter(Boolean);
  }
  if (imageKey === null) return [];
  if (typeof imageKey === "string" && imageKey.trim()) return [imageKey.trim()];
  return [];
}

function withImageUrl(origin: string, row: typeof productos.$inferSelect, includeCost = false) {
  const { categories: rawCategories, imageKeys: rawImageKeys, cost, ...rest } = row;
  const imageKeys = parseImageKeys(rawImageKeys, row.imageKey);
  const imageUrls = imageKeys
    .map((key) => buildImageUrl(origin, key))
    .filter((url): url is string => Boolean(url));
  return {
    ...rest,
    categories: parseCategories(rawCategories),
    imageKeys,
    imageUrls,
    imageKey: imageKeys[0] ?? null,
    imageUrl: imageUrls[0] ?? null,
    ...(includeCost ? { cost } : {}),
  };
}

// Public: list available products
productosRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const pagination = parseListPagination(c, 12);
  const filters = parseListFilters(c);

  const result = await queryProductList(
    db,
    origin,
    { ...filters, availableOnly: true },
    pagination,
  );

  return c.json(result);
});

// Public: list products in ludoteca
productosRoutes.get("/ludoteca", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const pagination = parseListPagination(c, 12);
  const filters = parseListFilters(c);

  const result = await queryProductList(
    db,
    origin,
    { ...filters, enLudoteca: true },
    pagination,
  );

  return c.json(result);
});

// Public: list favorite products
productosRoutes.get("/favoritos", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db
    .select()
    .from(productos)
    .where(eq(productos.esFavorito, true))
    .orderBy(desc(productos.createdAt))
    .all();
  return c.json({ productos: rows.map((r) => withImageUrl(origin, r)) });
});

// Public: single product
productosRoutes.get("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const row = await db
    .select()
    .from(productos)
    .where(eq(productos.id, c.req.param("id")))
    .get();
  if (!row) return c.json({ error: "Producto not found" }, 404);
  return c.json({ producto: withImageUrl(origin, row) });
});

// All routes below require auth
productosRoutes.use("*", authMiddleware);

// Admin: brands with stock available for bulk price adjustments
productosRoutes.get("/admin/publishers", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const rows = await db
    .select({
      publisher: productos.publisher,
      count: sql<number>`count(*)`,
    })
    .from(productos)
    .where(and(
      gt(productos.stock, 0),
      sql`trim(coalesce(${productos.publisher}, '')) <> ''`,
    ))
    .groupBy(productos.publisher)
    .orderBy(sql`lower(${productos.publisher})`)
    .all();

  return c.json({
    publishers: rows
      .filter((row): row is { publisher: string; count: number } => Boolean(row.publisher))
      .map((row) => ({ publisher: row.publisher, count: Number(row.count) })),
  });
});

// Admin: increase prices for one brand, only where stock is currently positive
productosRoutes.patch("/admin/prices", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ publisher?: unknown; percentage?: unknown }>();
  const publisher = typeof body.publisher === "string" ? body.publisher.trim() : "";
  const multiplier = priceMultiplierFromPercentage(body.percentage);

  if (!publisher) return c.json({ error: "La marca es obligatoria" }, 400);
  if (multiplier === null) {
    return c.json({ error: "El porcentaje debe ser mayor a 0 y menor o igual a 1000" }, 400);
  }

  const updated = await db
    .update(productos)
    .set({
      // ponytail: prices remain whole ARS; add a decimal money model if cent precision is ever needed.
      price: sql<number>`cast(round(${productos.price} * ${multiplier}) as integer)`,
      updatedAt: new Date(),
    })
    .where(and(eq(productos.publisher, publisher), gt(productos.stock, 0)))
    .returning({ id: productos.id })
    .all();

  return c.json({ publisher, updated: updated.length });
});

// Admin: list all products regardless of status
productosRoutes.get("/admin/all", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const pagination = parseListPagination(c, 20);
  const filters = parseListFilters(c);

  const result = await queryProductList(db, origin, filters, pagination, true);
  return c.json(result);
});

// Create
productosRoutes.post("/", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const body = await c.req.json<{
    title: string;
    description?: string;
    categories?: string | string[];
    condition?: ProductoCondition;
    minPlayers?: number;
    maxPlayers?: number;
    minAge?: number;
    estimatedMinutes?: number;
    difficulty?: number;
    publisher?: string;
    price: number;
    cost?: number;
    stock?: number;
    imageKey?: string | null;
    imageKeys?: string[];
    status?: unknown;
  }>();

  if (!body.title || body.price === undefined) {
    return c.json({ error: "Missing required fields: title, price" }, 400);
  }
  if (body.price < 0) return c.json({ error: "Invalid price" }, 400);
  if (body.cost !== undefined && (!Number.isFinite(body.cost) || body.cost < 0)) {
    return c.json({ error: "Invalid cost" }, 400);
  }
  if (body.stock !== undefined && body.stock < 0) return c.json({ error: "Invalid stock" }, 400);
  const status = body.status === undefined ? "available" : parseProductoStatus(body.status);
  if (!status) return c.json({ error: "Estado inválido" }, 400);

  const now = new Date();
  const normalizedImageKeys = normalizeImageKeysInput(body.imageKeys, body.imageKey);
  const row = {
    id: generateId(),
    title: body.title,
    description: body.description ?? null,
    categories: serializeCategories(normalizeCategoriesInput(body.categories)),
    condition: (body.condition ?? "nuevo") as ProductoCondition,
    minPlayers: body.minPlayers ?? 2,
    maxPlayers: body.maxPlayers ?? 4,
    minAge: body.minAge ?? 8,
    estimatedMinutes: body.estimatedMinutes ?? 60,
    difficulty: body.difficulty ?? 1.0,
    publisher: body.publisher ?? null,
    price: body.price,
    cost: body.cost ?? 0,
    stock: body.stock ?? 1,
    imageKey: normalizedImageKeys[0] ?? null,
    imageKeys: serializeImageKeys(normalizedImageKeys),
    status,
    enLudoteca: false,
    esFavorito: false,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(productos).values(row).run();
  const origin = new URL(c.req.url).origin;
  return c.json({ producto: withImageUrl(origin, row, true) }, 201);
});

// Update
productosRoutes.patch("/:id", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Producto id required" }, 400);
  const existing = await db.select().from(productos).where(eq(productos.id, id)).get();
  if (!existing) return c.json({ error: "Producto not found" }, 404);

  const body = await c.req.json<
    Partial<{
      title: string;
      description: string | null;
      categories: string | string[];
      condition: ProductoCondition;
      minPlayers: number;
      maxPlayers: number;
      minAge: number;
      estimatedMinutes: number;
      difficulty: number;
      publisher: string | null;
      price: number;
      cost: number;
      stock: number;
      imageKey: string | null;
      imageKeys: string[];
      status: unknown;
      enLudoteca: boolean;
      esFavorito: boolean;
    }>
  >();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.categories !== undefined) {
    patch.categories = serializeCategories(normalizeCategoriesInput(body.categories));
  }
  if (body.condition !== undefined) patch.condition = body.condition;
  if (body.minPlayers !== undefined) patch.minPlayers = body.minPlayers;
  if (body.maxPlayers !== undefined) patch.maxPlayers = body.maxPlayers;
  if (body.minAge !== undefined) patch.minAge = body.minAge;
  if (body.estimatedMinutes !== undefined) patch.estimatedMinutes = body.estimatedMinutes;
  if (body.difficulty !== undefined) patch.difficulty = body.difficulty;
  if (body.publisher !== undefined) patch.publisher = body.publisher;
  if (body.price !== undefined) {
    if (body.price < 0) return c.json({ error: "Invalid price" }, 400);
    patch.price = body.price;
  }
  if (body.cost !== undefined) {
    if (!Number.isFinite(body.cost) || body.cost < 0) return c.json({ error: "Invalid cost" }, 400);
    patch.cost = body.cost;
  }
  if (body.stock !== undefined) {
    if (body.stock < 0) return c.json({ error: "Invalid stock" }, 400);
    patch.stock = body.stock;
  }
  if (body.imageKeys !== undefined || body.imageKey !== undefined) {
    const normalizedImageKeys = normalizeImageKeysInput(body.imageKeys, body.imageKey);
    patch.imageKeys = serializeImageKeys(normalizedImageKeys);
    patch.imageKey = normalizedImageKeys[0] ?? null;
  }
  if (body.status !== undefined) {
    const status = parseProductoStatus(body.status);
    if (!status) return c.json({ error: "Estado inválido" }, 400);
    patch.status = status;
  }
  if (body.enLudoteca !== undefined) patch.enLudoteca = body.enLudoteca;
  if (body.esFavorito !== undefined) patch.esFavorito = body.esFavorito;

  await db.update(productos).set(patch).where(eq(productos.id, id)).run();
  const updated = await db.select().from(productos).where(eq(productos.id, id)).get();
  const origin = new URL(c.req.url).origin;
  return c.json({ producto: withImageUrl(origin, updated!, true) });
});

// Delete
productosRoutes.delete("/:id", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Producto id required" }, 400);
  const existing = await db.select().from(productos).where(eq(productos.id, id)).get();
  if (!existing) return c.json({ error: "Producto not found" }, 404);
  await db.delete(productos).where(eq(productos.id, id)).run();
  return c.json({ message: "Producto deleted" });
});

export default productosRoutes;

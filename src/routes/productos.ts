import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { createDbClient } from '../db';
import { productos } from '../db/schema';
import { authMiddleware, type AppEnv } from '../middleware/auth';
import { generateId } from '../utils/jwt';

const productosRoutes = new Hono<AppEnv>();

type ProductoCondition = 'nuevo' | 'como_nuevo' | 'usado';
type ProductoStatus = 'available' | 'sold_out' | 'draft';

function buildImageUrl(origin: string, imageKey: string | null) {
  if (!imageKey) return null;
  const encoded = imageKey.split('/').map(encodeURIComponent).join('/');
  return `${origin}/api/images/${encoded}`;
}

function withImageUrl(origin: string, row: typeof productos.$inferSelect) {
  return { ...row, imageUrl: buildImageUrl(origin, row.imageKey) };
}

// Public: list available products
productosRoutes.get('/', async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db
    .select()
    .from(productos)
    .where(eq(productos.status, 'available'))
    .orderBy(desc(productos.createdAt))
    .all();
  return c.json({ productos: rows.map((r) => withImageUrl(origin, r)) });
});

// Public: single product
productosRoutes.get('/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const row = await db.select().from(productos).where(eq(productos.id, c.req.param('id'))).get();
  if (!row) return c.json({ error: 'Producto not found' }, 404);
  return c.json({ producto: withImageUrl(origin, row) });
});

// All routes below require auth
productosRoutes.use('*', authMiddleware);

// Admin: list all products regardless of status
productosRoutes.get('/admin/all', async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db.select().from(productos).orderBy(desc(productos.createdAt)).all();
  return c.json({ productos: rows.map((r) => withImageUrl(origin, r)) });
});

// Create
productosRoutes.post('/', async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json<{
    title: string;
    description?: string;
    category?: string;
    condition?: ProductoCondition;
    minPlayers?: number;
    maxPlayers?: number;
    minAge?: number;
    estimatedMinutes?: number;
    publisher?: string;
    price: number;
    stock?: number;
    imageKey?: string | null;
    status?: ProductoStatus;
  }>();

  if (!body.title || body.price === undefined) {
    return c.json({ error: 'Missing required fields: title, price' }, 400);
  }
  if (body.price < 0) return c.json({ error: 'Invalid price' }, 400);

  const now = new Date();
  const row = {
    id: generateId(),
    title: body.title,
    description: body.description ?? null,
    category: body.category ?? 'otros',
    condition: (body.condition ?? 'nuevo') as ProductoCondition,
    minPlayers: body.minPlayers ?? 2,
    maxPlayers: body.maxPlayers ?? 4,
    minAge: body.minAge ?? 8,
    estimatedMinutes: body.estimatedMinutes ?? 60,
    publisher: body.publisher ?? null,
    price: body.price,
    stock: body.stock ?? 1,
    imageKey: body.imageKey ?? null,
    status: (body.status ?? 'available') as ProductoStatus,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(productos).values(row).run();
  const origin = new URL(c.req.url).origin;
  return c.json({ producto: withImageUrl(origin, row) }, 201);
});

// Update
productosRoutes.patch('/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');
  const existing = await db.select().from(productos).where(eq(productos.id, id)).get();
  if (!existing) return c.json({ error: 'Producto not found' }, 404);

  const body = await c.req.json<Partial<{
    title: string;
    description: string | null;
    category: string;
    condition: ProductoCondition;
    minPlayers: number;
    maxPlayers: number;
    minAge: number;
    estimatedMinutes: number;
    publisher: string | null;
    price: number;
    stock: number;
    imageKey: string | null;
    status: ProductoStatus;
  }>>();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.category !== undefined) patch.category = body.category;
  if (body.condition !== undefined) patch.condition = body.condition;
  if (body.minPlayers !== undefined) patch.minPlayers = body.minPlayers;
  if (body.maxPlayers !== undefined) patch.maxPlayers = body.maxPlayers;
  if (body.minAge !== undefined) patch.minAge = body.minAge;
  if (body.estimatedMinutes !== undefined) patch.estimatedMinutes = body.estimatedMinutes;
  if (body.publisher !== undefined) patch.publisher = body.publisher;
  if (body.price !== undefined) {
    if (body.price < 0) return c.json({ error: 'Invalid price' }, 400);
    patch.price = body.price;
  }
  if (body.stock !== undefined) patch.stock = body.stock;
  if (body.imageKey !== undefined) patch.imageKey = body.imageKey;
  if (body.status !== undefined) patch.status = body.status;

  await db.update(productos).set(patch).where(eq(productos.id, id)).run();
  const updated = await db.select().from(productos).where(eq(productos.id, id)).get();
  const origin = new URL(c.req.url).origin;
  return c.json({ producto: withImageUrl(origin, updated!) });
});

// Delete
productosRoutes.delete('/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');
  const existing = await db.select().from(productos).where(eq(productos.id, id)).get();
  if (!existing) return c.json({ error: 'Producto not found' }, 404);
  await db.delete(productos).where(eq(productos.id, id)).run();
  return c.json({ message: 'Producto deleted' });
});

export default productosRoutes;

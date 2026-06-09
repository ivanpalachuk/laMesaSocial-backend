import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { createDbClient } from '../db';
import { encuentros } from '../db/schema';
import { authMiddleware, type AppEnv } from '../middleware/auth';
import { generateId } from '../utils/jwt';

const encuentrosRoutes = new Hono<AppEnv>();

function buildImageUrl(origin: string, imageKey: string | null) {
  if (!imageKey) {
    return null;
  }

  const encoded = imageKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${origin}/api/images/${encoded}`;
}

function withImageUrl(origin: string, row: typeof encuentros.$inferSelect) {
  return {
    ...row,
    imageUrl: buildImageUrl(origin, row.imageKey),
  };
}

encuentrosRoutes.get('/', async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db
    .select()
    .from(encuentros)
    .where(and(eq(encuentros.status, 'published'), gte(encuentros.startsAt, new Date())))
    .all();

  return c.json({ encuentros: rows.map((row) => withImageUrl(origin, row)) });
});

encuentrosRoutes.get('/admin/all', authMiddleware, async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const rows = await db
    .select()
    .from(encuentros)
    .orderBy(desc(encuentros.startsAt))
    .all();

  return c.json({ encuentros: rows.map((row) => withImageUrl(origin, row)) });
});

encuentrosRoutes.get('/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;
  const id = c.req.param('id');

  const encuentro = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!encuentro) {
    return c.json({ error: 'Encuentro not found' }, 404);
  }

  return c.json({ encuentro: withImageUrl(origin, encuentro) });
});

encuentrosRoutes.use('*', authMiddleware);

encuentrosRoutes.post('/', async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json<{
    title: string;
    description?: string;
    location: string;
    startsAt: string;
    endsAt?: string;
    maxSeats?: number;
    availableSeats?: number;
    pricePerPerson?: number;
    imageKey?: string;
    status?: 'draft' | 'published' | 'cancelled';
  }>();

  if (!body.title || !body.location || !body.startsAt) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;

  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    return c.json({ error: 'Invalid date format' }, 400);
  }

  const maxSeats = body.maxSeats ?? 20;
  const availableSeats = body.availableSeats ?? maxSeats;
  const pricePerPerson = body.pricePerPerson ?? 20000;
  if (maxSeats <= 0 || availableSeats < 0 || availableSeats > maxSeats) {
    return c.json({ error: 'Invalid seats values' }, 400);
  }
  if (pricePerPerson < 0) {
    return c.json({ error: 'Invalid pricePerPerson value' }, 400);
  }

  const now = new Date();
  const newEncuentro = {
    id: generateId(),
    title: body.title,
    description: body.description ?? null,
    location: body.location,
    startsAt,
    endsAt,
    maxSeats,
    availableSeats,
    pricePerPerson,
    imageKey: body.imageKey ?? null,
    status: body.status ?? 'published',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(encuentros).values(newEncuentro).run();
  return c.json({ encuentro: newEncuentro }, 201);
});

encuentrosRoutes.patch('/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json<{
    title?: string;
    description?: string | null;
    location?: string;
    startsAt?: string;
    endsAt?: string | null;
    maxSeats?: number;
    availableSeats?: number;
    pricePerPerson?: number;
    imageKey?: string | null;
    status?: 'draft' | 'published' | 'cancelled';
  }>();

  const existing = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Encuentro not found' }, 404);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.location !== undefined) patch.location = body.location;
  if (body.startsAt !== undefined) {
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) return c.json({ error: 'Invalid startsAt date' }, 400);
    patch.startsAt = startsAt;
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt === null) {
      patch.endsAt = null;
    } else {
      const endsAt = new Date(body.endsAt);
      if (Number.isNaN(endsAt.getTime())) return c.json({ error: 'Invalid endsAt date' }, 400);
      patch.endsAt = endsAt;
    }
  }
  if (body.maxSeats !== undefined) patch.maxSeats = body.maxSeats;
  if (body.availableSeats !== undefined) patch.availableSeats = body.availableSeats;
  if (body.pricePerPerson !== undefined) {
    if (body.pricePerPerson < 0) {
      return c.json({ error: 'Invalid pricePerPerson value' }, 400);
    }
    patch.pricePerPerson = body.pricePerPerson;
  }
  if (body.imageKey !== undefined) {
    patch.imageKey = body.imageKey;
  }
  if (body.status !== undefined) patch.status = body.status;

  await db.update(encuentros).set(patch).where(eq(encuentros.id, id)).run();

  const updated = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!updated) {
    return c.json({ error: 'Encuentro not found' }, 404);
  }

  return c.json({ encuentro: withImageUrl(new URL(c.req.url).origin, updated) });
});

encuentrosRoutes.delete('/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const existing = await db.select().from(encuentros).where(eq(encuentros.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Encuentro not found' }, 404);
  }

  await db.delete(encuentros).where(eq(encuentros.id, id)).run();
  return c.json({ message: 'Encuentro deleted' });
});

export default encuentrosRoutes;

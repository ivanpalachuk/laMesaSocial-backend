import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../db';
import { refreshTokens, users } from '../db/schema';
import type { AppEnv } from '../middleware/auth';
import { generateAccessToken, generateId, generateRefreshToken, verifyToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

const auth = new Hono<AppEnv>();

function withoutPassword<T extends { password: string }>(user: T) {
  const { password: _, ...safeUser } = user;
  return safeUser;
}

auth.post('/register', async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ email: string; password: string; name: string }>();

  if (!body.email || !body.password || !body.name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (body.password.length < 6) {
    return c.json({ error: 'Password must have at least 6 characters' }, 400);
  }

  const existingUser = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).get();
  if (existingUser) {
    return c.json({ error: 'User already exists' }, 409);
  }

  const now = new Date();
  const newUser = {
    id: generateId(),
    email: body.email.toLowerCase(),
    password: await hashPassword(body.password),
    name: body.name,
    role: 'user' as const,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values(newUser).run();

  return c.json({ user: withoutPassword(newUser) }, 201);
});

auth.post('/login', async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Missing email or password' }, 400);
  }

  const user = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).get();
  if (!user || !user.isActive) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const validPassword = await verifyPassword(body.password, user.password);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const accessToken = await generateAccessToken(user.id, user.email, user.role, c.env.JWT_SECRET);
  const refreshToken = await generateRefreshToken(user.id, c.env.JWT_REFRESH_SECRET);

  await db.insert(refreshTokens).values({
    id: generateId(),
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  }).run();

  return c.json({
    accessToken,
    refreshToken,
    user: withoutPassword(user),
  });
});

auth.post('/refresh', async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ refreshToken: string }>();

  if (!body.refreshToken) {
    return c.json({ error: 'Missing refresh token' }, 400);
  }

  const payload = await verifyToken(body.refreshToken, c.env.JWT_REFRESH_SECRET);
  if (!payload?.userId) {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  const storedToken = await db.select().from(refreshTokens).where(eq(refreshTokens.token, body.refreshToken)).get();
  if (!storedToken || storedToken.expiresAt < new Date()) {
    return c.json({ error: 'Refresh token expired or invalid' }, 401);
  }

  const user = await db.select().from(users).where(eq(users.id, payload.userId as string)).get();
  if (!user || !user.isActive) {
    return c.json({ error: 'User not found' }, 404);
  }

  const accessToken = await generateAccessToken(user.id, user.email, user.role, c.env.JWT_SECRET);
  return c.json({ accessToken });
});

auth.post('/logout', async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ refreshToken: string }>();

  if (!body.refreshToken) {
    return c.json({ error: 'Missing refresh token' }, 400);
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.token, body.refreshToken)).run();
  return c.json({ message: 'Logged out successfully' });
});

auth.get('/me', async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get('userId');
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user || !user.isActive) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user: withoutPassword(user) });
});

export default auth;

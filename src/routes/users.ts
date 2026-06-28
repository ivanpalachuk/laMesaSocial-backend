import { Hono } from "hono";
import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import { createDbClient } from "../db";
import { users } from "../db/schema";
import type { AppEnv } from "../middleware/auth";
import type { UserRole } from "../middleware/auth";
import { generateId } from "../utils/jwt";
import { hashPassword } from "../utils/password";
import { resolveEffectiveUserRole } from "../utils/user-profile";

const usersRoutes = new Hono<AppEnv>();

function normalizePersistedRole(role: string | undefined): "admin" | "user" {
  if (role === "admin") return role;
  return "user";
}

function shouldEnableArticleEditing(role: UserRole | undefined) {
  return role === "article_editor";
}

function withoutPassword<T extends { canEditArticles: boolean; password: string; role: "admin" | "user" }>(user: T) {
  const { password: _, ...safeUser } = user;
  return { ...safeUser, role: resolveEffectiveUserRole(user) };
}

async function countOtherActiveAdmins(db: ReturnType<typeof createDbClient>, excludeUserId: string) {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, excludeUserId)))
    .get();

  return Number(row?.count ?? 0);
}

usersRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const q = c.req.query("q")?.trim();

  if (q) {
    const pattern = `%${q}%`;
    const rows = await db
      .select()
      .from(users)
      .where(or(like(users.name, pattern), like(users.email, pattern)))
      .orderBy(desc(users.createdAt))
      .all();

    return c.json({ users: rows.map(withoutPassword) });
  }

  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).all();
  return c.json({ users: rows.map(withoutPassword) });
});

usersRoutes.get("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  const user = await db.select().from(users).where(eq(users.id, id)).get();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user: withoutPassword(user) });
});

usersRoutes.post("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }>();

  if (!body.name?.trim() || !body.email?.trim() || !body.password) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (body.password.length < 6) {
    return c.json({ error: "Password must have at least 6 characters" }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: "User already exists" }, 409);
  }

  const now = new Date();
  const newUser = {
    id: generateId(),
    email,
    password: await hashPassword(body.password),
    name: body.name.trim(),
    role: normalizePersistedRole(body.role),
    canEditArticles: shouldEnableArticleEditing(body.role),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values(newUser).run();

  return c.json({ user: withoutPassword(newUser) }, 201);
});

usersRoutes.patch("/:id", async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  const actorId = c.get("userId");
  const body = await c.req.json<{
    name?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
    password?: string;
  }>();

  const user = await db.select().from(users).where(eq(users.id, id)).get();
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const nextRole = body.role === undefined ? undefined : normalizePersistedRole(body.role);
  const nextCanEditArticles = body.role === undefined ? undefined : shouldEnableArticleEditing(body.role);

  if (id === actorId) {
    if (nextRole && nextRole !== "admin") {
      return c.json({ error: "Cannot demote your own admin role" }, 400);
    }

    if (body.isActive === false) {
      return c.json({ error: "Cannot deactivate your own account" }, 400);
    }
  }

  if (((nextRole !== undefined && nextRole !== "admin") || body.isActive === false) && user.role === "admin" && user.isActive) {
    const otherActiveAdmins = await countOtherActiveAdmins(db, id);
    if (otherActiveAdmins === 0) {
      return c.json({ error: "Cannot remove the last active admin" }, 400);
    }
  }

  if (body.email?.trim()) {
    const email = body.email.toLowerCase().trim();
    if (email !== user.email) {
      const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
      if (existingUser) {
        return c.json({ error: "Email already in use" }, 409);
      }
    }
  }

  if (body.password && body.password.length < 6) {
    return c.json({ error: "Password must have at least 6 characters" }, 400);
  }

  const updates: {
    name?: string;
    email?: string;
    role?: "admin" | "user";
    canEditArticles?: boolean;
    isActive?: boolean;
    password?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.email?.trim()) updates.email = body.email.toLowerCase().trim();
  if (nextRole) updates.role = nextRole;
  if (nextCanEditArticles !== undefined) updates.canEditArticles = nextCanEditArticles;
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (body.password) updates.password = await hashPassword(body.password);

  await db.update(users).set(updates).where(eq(users.id, id)).run();

  const updatedUser = await db.select().from(users).where(eq(users.id, id)).get();
  if (!updatedUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user: withoutPassword(updatedUser) });
});

export default usersRoutes;

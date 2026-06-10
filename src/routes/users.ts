import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db";
import { users } from "../db/schema";
import type { AppEnv } from "../middleware/auth";

const usersRoutes = new Hono<AppEnv>();

function withoutPassword<T extends { password: string }>(user: T) {
  const { password: _, ...safeUser } = user;
  return safeUser;
}

usersRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const rows = await db.select().from(users).all();
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

export default usersRoutes;

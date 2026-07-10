import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDbClient } from "../db";
import { newsletterSubscribers, users } from "../db/schema";
import type { AppEnv } from "../middleware/auth";
import { normalizeNewsletterEmail } from "./newsletter-validation";

const newsletterRoutes = new Hono<AppEnv>();

newsletterRoutes.post("/subscribe", async (c) => {
  const body = await c.req.json<{ email?: unknown }>().catch(() => null);
  const email = normalizeNewsletterEmail(body?.email);
  if (!email) return c.json({ error: "Ingresá un correo válido." }, 400);

  const db = createDbClient(c.env.DB);
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();

  if (user) {
    await db.update(users).set({ notifyEvents: true, updatedAt: new Date() }).where(eq(users.id, user.id)).run();
  } else {
    await db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email,
      createdAt: new Date(),
    }).onConflictDoNothing().run();
  }

  return c.json({ message: "¡Listo! Te avisaremos cuando haya novedades." });
});

export default newsletterRoutes;

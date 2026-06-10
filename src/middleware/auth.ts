import type { Context, Next } from "hono";
import { verifyToken } from "../utils/jwt";

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    IMAGES: R2Bucket;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    CORS_ORIGINS?: string;
  };
  Variables: {
    userId: string;
    userEmail: string;
    userRole: string;
  };
};

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload?.userId) {
    return c.json({ error: "Invalid token" }, 401);
  }

  c.set("userId", payload.userId as string);
  c.set("userEmail", (payload.email as string) ?? "");
  c.set("userRole", (payload.role as string) ?? "user");

  await next();
}

export async function adminOnly(c: Context<AppEnv>, next: Next) {
  if (c.get("userRole") !== "admin") {
    return c.json({ error: "Forbidden: Admin access required" }, 403);
  }

  await next();
}

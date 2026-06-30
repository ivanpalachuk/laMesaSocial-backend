import type { Context, Next } from "hono";
import { verifyToken } from "../utils/jwt";

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    IMAGES: R2Bucket;
    IMAGE_TRANSFORMER: ImagesBinding;
    AI: Ai;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    RESEND_API_KEY?: string;
    GEMINI_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    PASSWORD_RESET_FROM_EMAIL?: string;
    RESEND_FROM_NAME?: string;
    APP_URL?: string;
    EMAIL_LOGO_URL?: string;
    WELCOME_EMAIL_LOGO_URL?: string;
    ORDERS_FROM_EMAIL?: string;
    EVENTS_FROM_EMAIL?: string;
    ORDERS_ADMIN_EMAIL?: string;
    MERCADOPAGO_ACCESS_TOKEN?: string;
    MERCADOPAGO_WEBHOOK_URL?: string;
    MERCADOPAGO_USE_SANDBOX?: string;
    CORS_ORIGINS?: string;
  };
  Variables: {
    userId: string;
    userEmail: string;
    userRole: string;
  };
};

export type UserRole = "admin" | "article_editor" | "user";

export function isAdminRole(role: string | undefined) {
  return role === "admin";
}

export function canManageArticles(role: string | undefined) {
  return role === "admin" || role === "article_editor";
}

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
  if (!isAdminRole(c.get("userRole"))) {
    return c.json({ error: "Forbidden: Admin access required" }, 403);
  }

  await next();
}

export async function articleManagerOnly(c: Context<AppEnv>, next: Next) {
  if (!canManageArticles(c.get("userRole"))) {
    return c.json({ error: "Forbidden: Article editor access required" }, 403);
  }

  await next();
}

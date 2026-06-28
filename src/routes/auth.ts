import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db";
import { passwordResetTokens, refreshTokens, users } from "../db/schema";
import type { AppEnv } from "../middleware/auth";
import { resolveEmailConfig, sendPasswordResetEmail, sendWelcomeEmail } from "../utils/email";
import { generateAccessToken, generateId, generateRefreshToken, verifyToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";
import { resolveEffectiveUserRole, serializeUserProfile } from "../utils/user-profile";

const auth = new Hono<AppEnv>();

async function profileResponse(origin: string, user: typeof users.$inferSelect, images?: R2Bucket) {
  return { user: await serializeUserProfile(origin, user, images) };
}

auth.post("/register", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ email: string; password: string; name: string }>();

  if (!body.email || !body.password || !body.name) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (body.password.length < 6) {
    return c.json({ error: "Password must have at least 6 characters" }, 400);
  }

  const existingUser = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).get();
  if (existingUser) {
    return c.json({ error: "User already exists" }, 409);
  }

  const now = new Date();
  const newUser = {
    id: generateId(),
    email: body.email.toLowerCase(),
    password: await hashPassword(body.password),
    name: body.name,
    role: "user" as const,
    canEditArticles: false,
    isActive: true,
    avatarImageKey: null,
    avatarImageKeys: "[]",
    avatarPreset: null,
    bio: null,
    gamerDna: "[]",
    discoveryZone: null,
    notifyEvents: true,
    notifyGroupInvites: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values(newUser).run();

  const welcomeEmailConfig = resolveEmailConfig(c.env);
  if (welcomeEmailConfig) {
    c.executionCtx.waitUntil(
      sendWelcomeEmail(welcomeEmailConfig, newUser.email, newUser.name).catch((error) => {
        console.error("Welcome email failed:", error);
      }),
    );
  }

  return c.json(await profileResponse(new URL(c.req.url).origin, newUser, c.env.IMAGES), 201);
});

auth.post("/login", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: "Missing email or password" }, 400);
  }

  const user = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).get();
  if (!user || !user.isActive) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const validPassword = await verifyPassword(body.password, user.password);
  if (!validPassword) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const accessToken = await generateAccessToken(user.id, user.email, resolveEffectiveUserRole(user), c.env.JWT_SECRET);
  const refreshToken = await generateRefreshToken(user.id, c.env.JWT_REFRESH_SECRET);

  await db
    .insert(refreshTokens)
    .values({
      id: generateId(),
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    })
    .run();

  const origin = new URL(c.req.url).origin;

  return c.json({
    accessToken,
    refreshToken,
    ...(await profileResponse(origin, user, c.env.IMAGES)),
  });
});

auth.post("/refresh", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ refreshToken: string }>();

  if (!body.refreshToken) {
    return c.json({ error: "Missing refresh token" }, 400);
  }

  const payload = await verifyToken(body.refreshToken, c.env.JWT_REFRESH_SECRET);
  if (!payload?.userId) {
    return c.json({ error: "Invalid refresh token" }, 401);
  }

  const storedToken = await db.select().from(refreshTokens).where(eq(refreshTokens.token, body.refreshToken)).get();
  if (!storedToken || storedToken.expiresAt < new Date()) {
    return c.json({ error: "Refresh token expired or invalid" }, 401);
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId as string))
    .get();
  if (!user || !user.isActive) {
    return c.json({ error: "User not found" }, 404);
  }

  const accessToken = await generateAccessToken(user.id, user.email, resolveEffectiveUserRole(user), c.env.JWT_SECRET);
  return c.json({ accessToken });
});

auth.post("/forgot-password", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ email: string }>();

  if (!body.email?.trim()) {
    return c.json({ error: "Missing email" }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  const emailConfig = resolveEmailConfig(c.env);

  if (user && user.isActive && emailConfig) {
    const token = generateId();
    const now = new Date();

    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id))
      .run();

    await db
      .insert(passwordResetTokens)
      .values({
        id: generateId(),
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: now,
      })
      .run();

    c.executionCtx.waitUntil(
      sendPasswordResetEmail(emailConfig, user.email, user.name, token).catch((error) => {
        console.error("Password reset email failed:", error);
      }),
    );
  }

  return c.json({
    message: "Si el correo existe en nuestra base, recibirás instrucciones para restablecer tu contraseña.",
  });
});

auth.post("/reset-password", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ token: string; password: string }>();

  if (!body.token?.trim() || !body.password) {
    return c.json({ error: "Missing token or password" }, 400);
  }

  if (body.password.length < 6) {
    return c.json({ error: "Password must have at least 6 characters" }, 400);
  }

  const resetToken = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, body.token.trim()))
    .get();

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return c.json({ error: "Invalid or expired reset token" }, 400);
  }

  const user = await db.select().from(users).where(eq(users.id, resetToken.userId)).get();
  if (!user || !user.isActive) {
    return c.json({ error: "Invalid or expired reset token" }, 400);
  }

  const now = new Date();
  const hashedPassword = await hashPassword(body.password);

  await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: now })
    .where(eq(users.id, user.id))
    .run();

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)).run();
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id)).run();

  return c.json({ message: "Password updated successfully" });
});

auth.post("/logout", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{ refreshToken: string }>();

  if (!body.refreshToken) {
    return c.json({ error: "Missing refresh token" }, 400);
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.token, body.refreshToken)).run();
  return c.json({ message: "Logged out successfully" });
});

auth.get("/me", async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user || !user.isActive) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(await profileResponse(new URL(c.req.url).origin, user, c.env.IMAGES));
});

export default auth;

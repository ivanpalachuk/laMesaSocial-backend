import { Hono } from "hono";
import { cors } from "hono/cors";
import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import encuentrosRoutes from "./routes/encuentros";
import imagesRoutes from "./routes/images";
import productosRoutes from "./routes/productos";
import encyclopediaRoutes from "./routes/encyclopedia";
import meRoutes from "./routes/me";
import pedidosRoutes from "./routes/pedidos";
import paymentsRoutes from "./routes/payments";
import adminStatsRoutes from "./routes/admin-stats";
import { adminOnly, authMiddleware, type AppEnv } from "./middleware/auth";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      const allowedOrigins = (c.env.CORS_ORIGINS || "http://localhost:5174").split(",").map((item) => item.trim());

      if (!origin) {
        return allowedOrigins[0] || "http://localhost:5174";
      }

      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      if (origin.endsWith(".pages.dev")) {
        return origin;
      }

      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  return corsMiddleware(c, next);
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "lamesasocial-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth/me", authMiddleware);
app.route("/api/auth", authRoutes);

app.use("/api/users*", authMiddleware, adminOnly);
app.route("/api/users", usersRoutes);

app.route("/api/encuentros", encuentrosRoutes);
app.route("/api/images", imagesRoutes);
app.route("/api/productos", productosRoutes);
app.route("/api/encyclopedia", encyclopediaRoutes);
app.route("/api/me", meRoutes);
app.route("/api/pedidos", pedidosRoutes);
app.route("/api/payments", paymentsRoutes);
app.use("/api/admin/stats*", authMiddleware, adminOnly);
app.route("/api/admin/stats", adminStatsRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

export default app;

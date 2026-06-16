import { Hono } from "hono";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { createDbClient } from "../db";
import {
  encuentroComments,
  encuentros,
  pedidos,
  users,
} from "../db/schema";
import { adminOnly, authMiddleware, type AppEnv } from "../middleware/auth";

const adminStatsRoutes = new Hono<AppEnv>();

adminStatsRoutes.use("*", authMiddleware, adminOnly);

adminStatsRoutes.get("/", async (c) => {
  const db = createDbClient(c.env.DB);
  const now = new Date();

  // Start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    pendingCommentsCount,
    pendingPedidosCount,
    usersThisMonthCount,
    totalUsersCount,
    upcomingEncuentros,
    recentPedidos,
    recentComments,
  ] = await Promise.all([
    // Pending comments
    db
      .select({ count: sql<number>`count(*)` })
      .from(encuentroComments)
      .where(eq(encuentroComments.status, "pending"))
      .get(),

    // Pending orders
    db
      .select({ count: sql<number>`count(*)` })
      .from(pedidos)
      .where(eq(pedidos.status, "pending"))
      .get(),

    // Users registered this month
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, startOfMonth))
      .get(),

    // Total active users
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true))
      .get(),

    // Upcoming published events
    db
      .select({
        id: encuentros.id,
        title: encuentros.title,
        startsAt: encuentros.startsAt,
        location: encuentros.location,
        availableSeats: encuentros.availableSeats,
        maxSeats: encuentros.maxSeats,
      })
      .from(encuentros)
      .where(
        and(eq(encuentros.status, "published"), gte(encuentros.startsAt, now)),
      )
      .orderBy(encuentros.startsAt)
      .limit(5)
      .all(),

    // Recent orders (last 8)
    db
      .select({
        id: pedidos.id,
        status: pedidos.status,
        total: pedidos.total,
        customerName: pedidos.customerName,
        createdAt: pedidos.createdAt,
      })
      .from(pedidos)
      .orderBy(desc(pedidos.createdAt))
      .limit(8)
      .all(),

    // Recent pending comments (last 6)
    db
      .select({
        id: encuentroComments.id,
        content: encuentroComments.content,
        status: encuentroComments.status,
        createdAt: encuentroComments.createdAt,
        authorName: users.name,
        encuentroTitle: encuentros.title,
        encuentroId: encuentroComments.encuentroId,
      })
      .from(encuentroComments)
      .innerJoin(users, eq(users.id, encuentroComments.userId))
      .innerJoin(encuentros, eq(encuentros.id, encuentroComments.encuentroId))
      .where(eq(encuentroComments.status, "pending"))
      .orderBy(desc(encuentroComments.createdAt))
      .limit(6)
      .all(),
  ]);

  // Total available seats across upcoming events
  const totalAvailableSeats = upcomingEncuentros.reduce(
    (sum, e) => sum + e.availableSeats,
    0,
  );

  return c.json({
    stats: {
      pendingComments: Number(pendingCommentsCount?.count ?? 0),
      pendingPedidos: Number(pendingPedidosCount?.count ?? 0),
      usersThisMonth: Number(usersThisMonthCount?.count ?? 0),
      totalUsers: Number(totalUsersCount?.count ?? 0),
      upcomingEncuentros: upcomingEncuentros.length,
      totalAvailableSeats,
    },
    recentPedidos,
    recentComments,
    nextEncuentros: upcomingEncuentros,
  });
});

export default adminStatsRoutes;

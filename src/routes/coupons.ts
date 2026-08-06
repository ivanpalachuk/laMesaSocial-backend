import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { createDbClient } from "../db";
import { couponRedemptions, coupons, pedidos, productos } from "../db/schema";
import { adminOnly, authMiddleware, type AppEnv } from "../middleware/auth";
import { normalizeCouponCode, resolveCoupon } from "../utils/coupons";
import { generateId } from "../utils/jwt";

const couponsRoutes = new Hono<AppEnv>();
type DiscountType = "percentage" | "fixed" | "volume_percentage";

couponsRoutes.use("*", authMiddleware);

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function serializeCoupon(coupon: typeof coupons.$inferSelect) {
  return {
    ...coupon,
    discountType: coupon.maximumQuantity === null ? coupon.discountType : "volume_percentage",
    startsAt: coupon.startsAt?.toISOString() ?? null,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

couponsRoutes.post("/validate", async (c) => {
  const db = createDbClient(c.env.DB);
  const body = await c.req.json<{
    code?: string;
    items?: { productoId?: string; quantity?: number }[];
  }>();
  const merged = new Map<string, number>();
  for (const item of body.items ?? []) {
    if (!item.productoId) continue;
    const quantity = Math.floor(Number(item.quantity));
    if (Number.isFinite(quantity) && quantity > 0) {
      merged.set(item.productoId, (merged.get(item.productoId) ?? 0) + quantity);
    }
  }
  if (!merged.size) return c.json({ error: "El carrito está vacío" }, 400);

  let subtotal = 0;
  let itemQuantity = 0;
  for (const [productoId, quantity] of merged) {
    const producto = await db.select().from(productos).where(eq(productos.id, productoId)).get();
    if (!producto || producto.status === "draft" || producto.stock < quantity) {
      return c.json({ error: "Hay productos no disponibles en el carrito" }, 409);
    }
    subtotal += producto.price * quantity;
    itemQuantity += quantity;
  }

  const result = await resolveCoupon(db, body.code, subtotal, itemQuantity);
  if (result.error) return c.json({ error: result.error }, 400);
  if (!result.coupon || !result.code) return c.json({ error: "Ingresá un cupón" }, 400);
  return c.json({
    code: result.code,
    subtotal,
    itemQuantity,
    discountAmount: result.discountAmount,
    discountedSubtotal: subtotal - result.discountAmount,
  });
});

couponsRoutes.get("/admin", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const rows = await db.select().from(coupons).orderBy(asc(coupons.code)).all();
  const attributionRows = await db
    .select({
      couponId: couponRedemptions.couponId,
      discountAmount: couponRedemptions.discountAmount,
      redeemedAt: couponRedemptions.createdAt,
      pedidoId: pedidos.id,
      customerName: pedidos.customerName,
      customerEmail: pedidos.customerEmail,
      status: pedidos.status,
      paymentStatus: pedidos.paymentStatus,
      total: pedidos.total,
      createdAt: pedidos.createdAt,
    })
    .from(couponRedemptions)
    .innerJoin(pedidos, eq(couponRedemptions.pedidoId, pedidos.id))
    .orderBy(desc(couponRedemptions.createdAt))
    .all();

  const rowsByCoupon = new Map<string, typeof attributionRows>();
  for (const row of attributionRows) {
    const group = rowsByCoupon.get(row.couponId) ?? [];
    group.push(row);
    rowsByCoupon.set(row.couponId, group);
  }

  return c.json({
    coupons: rows.map((coupon) => {
      const attempts = rowsByCoupon.get(coupon.id) ?? [];
      const sales = attempts.filter((row) => row.status === "confirmed" || row.status === "fulfilled");
      const attributedRevenue = sales.reduce((sum, row) => sum + row.total, 0);
      const attributedDiscount = sales.reduce((sum, row) => sum + row.discountAmount, 0);
      return {
        ...serializeCoupon(coupon),
        analytics: {
          attempts: attempts.length,
          sales: sales.length,
          attributedRevenue,
          attributedDiscount,
          averageTicket: sales.length ? Math.round(attributedRevenue / sales.length) : 0,
          conversionRate: attempts.length ? Math.round((sales.length / attempts.length) * 1000) / 10 : 0,
        },
        orders: attempts.map((row) => ({
          id: row.pedidoId,
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          status: row.status,
          paymentStatus: row.paymentStatus,
          total: row.total,
          discountAmount: row.discountAmount,
          createdAt: row.createdAt.toISOString(),
          isSale: row.status === "confirmed" || row.status === "fulfilled",
        })),
      };
    }),
  });
});

couponsRoutes.post("/admin", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const body = await c.req.json<Record<string, unknown>>();
  const code = normalizeCouponCode(body.code);
  const requestedDiscountType = body.discountType as DiscountType;
  const isVolumeDiscount = requestedDiscountType === "volume_percentage";
  const discountType = isVolumeDiscount ? "percentage" : requestedDiscountType;
  const discountValue = Math.floor(Number(body.discountValue));
  const minimumSubtotal = body.minimumSubtotal === null || body.minimumSubtotal === ""
    ? null : Math.floor(Number(body.minimumSubtotal));
  const maximumDiscount = body.maximumDiscount === null || body.maximumDiscount === ""
    ? null : Math.floor(Number(body.maximumDiscount));
  const maximumQuantity = isVolumeDiscount ? Math.floor(Number(body.maximumQuantity)) : null;
  const usageLimit = body.usageLimit === null || body.usageLimit === ""
    ? null : Math.floor(Number(body.usageLimit));
  const parsedStartsAt = parseOptionalDate(body.startsAt);
  const parsedExpiresAt = parseOptionalDate(body.expiresAt);
  if (body.startsAt !== undefined && body.startsAt !== null && body.startsAt !== "" && parsedStartsAt === undefined) {
    return c.json({ error: "Inicio de vigencia inválido" }, 400);
  }
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "" && parsedExpiresAt === undefined) {
    return c.json({ error: "Vencimiento inválido" }, 400);
  }
  const startsAt = parsedStartsAt ?? null;
  const expiresAt = parsedExpiresAt ?? null;

  if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) return c.json({ error: "Código inválido" }, 400);
  if (discountType !== "percentage" && discountType !== "fixed") return c.json({ error: "Tipo inválido" }, 400);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return c.json({ error: "Descuento inválido" }, 400);
  if (discountType === "percentage" && discountValue > 100) return c.json({ error: "El porcentaje no puede superar 100" }, 400);
  if (minimumSubtotal !== null && (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0)) return c.json({ error: "Compra mínima inválida" }, 400);
  if (maximumDiscount !== null && (!Number.isFinite(maximumDiscount) || maximumDiscount <= 0)) return c.json({ error: "Tope inválido" }, 400);
  if (isVolumeDiscount && (maximumQuantity === null || !Number.isFinite(maximumQuantity) || maximumQuantity <= 0)) return c.json({ error: "Cantidad máxima inválida" }, 400);
  if (maximumQuantity !== null && discountValue * maximumQuantity > 100) return c.json({ error: "El porcentaje máximo no puede superar 100" }, 400);
  if (usageLimit !== null && (!Number.isFinite(usageLimit) || usageLimit <= 0)) return c.json({ error: "Límite inválido" }, 400);
  if (startsAt && expiresAt && startsAt >= expiresAt) return c.json({ error: "La vigencia es inválida" }, 400);

  const now = new Date();
  try {
    await db.insert(coupons).values({
      id: generateId(), code, discountType, discountValue, minimumSubtotal,
      maximumDiscount: discountType === "percentage" ? maximumDiscount : null,
      maximumQuantity,
      usageLimit, usedCount: 0, startsAt, expiresAt,
      isActive: body.isActive !== false, createdBy: userId, createdAt: now, updatedAt: now,
    }).run();
  } catch {
    return c.json({ error: "Ya existe un cupón con ese código" }, 409);
  }
  const coupon = await db.select().from(coupons).where(eq(coupons.code, code)).get();
  return c.json({ coupon: coupon ? serializeCoupon(coupon) : null }, 201);
});

couponsRoutes.patch("/admin/:id", adminOnly, async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Cupón no encontrado" }, 404);
  const existing = await db.select().from(coupons).where(eq(coupons.id, id)).get();
  if (!existing) return c.json({ error: "Cupón no encontrado" }, 404);
  const body = await c.req.json<{ isActive?: boolean; usageLimit?: number | null; expiresAt?: string | null }>();
  const patch: Partial<typeof coupons.$inferInsert> = { updatedAt: new Date() };
  if (body.isActive !== undefined) patch.isActive = body.isActive;
  if (body.usageLimit !== undefined) {
    if (body.usageLimit !== null && (!Number.isInteger(body.usageLimit) || body.usageLimit <= 0 || body.usageLimit < existing.usedCount)) {
      return c.json({ error: "El límite no puede ser menor a los usos actuales" }, 400);
    }
    patch.usageLimit = body.usageLimit;
  }
  if (body.expiresAt !== undefined) {
    const expiresAt = parseOptionalDate(body.expiresAt);
    if (expiresAt === undefined) return c.json({ error: "Vencimiento inválido" }, 400);
    if (existing.startsAt && expiresAt && existing.startsAt >= expiresAt) return c.json({ error: "La vigencia es inválida" }, 400);
    patch.expiresAt = expiresAt;
  }
  await db.update(coupons).set(patch).where(eq(coupons.id, id)).run();
  const coupon = await db.select().from(coupons).where(eq(coupons.id, id)).get();
  return c.json({ coupon: coupon ? serializeCoupon(coupon) : null });
});

export default couponsRoutes;

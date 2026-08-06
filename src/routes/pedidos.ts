import { Hono, type Context } from "hono";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { createDbClient } from "../db";
import { couponRedemptions, coupons, pedidoItems, pedidos, productos, users } from "../db/schema";
import { authMiddleware, adminOnly, type AppEnv } from "../middleware/auth";
import {
  resolveEmailConfig,
  sendOrderAdminEmail,
  sendOrderConfirmationEmail,
} from "../utils/email";
import { generateId } from "../utils/jwt";
import { createMercadoPagoPreference } from "../utils/mercadopago";
import { resolveCoupon } from "../utils/coupons";

const pedidosRoutes = new Hono<AppEnv>();

const SHIPPING_COST_MDQ = 2500;
type PedidoStatus = "pending" | "confirmed" | "cancelled" | "fulfilled";
type PedidoContext = Context<AppEnv>;
type PaymentProvider = "manual" | "mercadopago";
type DeliveryMethod = "pickup" | "shipping";

type CheckoutItemInput = {
  productoId: string;
  quantity: number;
};

function resolveDeliveryMethod(value: unknown): DeliveryMethod {
  return value === "shipping" ? "shipping" : "pickup";
}

function deliveryDetails(method: DeliveryMethod) {
  if (method === "shipping") {
    return {
      shippingCost: SHIPPING_COST_MDQ,
      shippingCity: "Mar del Plata, MDQ",
    };
  }

  return {
    shippingCost: 0,
    shippingCity: "Retiro en sucursal",
  };
}

async function rollbackPedidoReservation(
  db: ReturnType<typeof createDbClient>,
  pedidoId: string,
  lineItems: { productoId: string; quantity: number; newStock: number }[],
) {
  for (const item of lineItems) {
    const restoredStock = item.newStock + item.quantity;
    await db
      .update(productos)
      .set({
        stock: restoredStock,
        updatedAt: new Date(),
      })
      .where(eq(productos.id, item.productoId))
      .run();
  }

  await db.delete(pedidos).where(eq(pedidos.id, pedidoId)).run();
}

async function deletePedido(db: ReturnType<typeof createDbClient>, pedidoId: string) {
  await db.delete(pedidos).where(eq(pedidos.id, pedidoId)).run();
}

async function releaseCouponUse(db: ReturnType<typeof createDbClient>, couponId: string) {
  await db
    .update(coupons)
    .set({ usedCount: sql`max(${coupons.usedCount} - 1, 0)`, updatedAt: new Date() })
    .where(eq(coupons.id, couponId))
    .run();
}

function formatPedidoResponse(
  pedido: typeof pedidos.$inferSelect,
  items: (typeof pedidoItems.$inferSelect)[],
) {
  return {
    id: pedido.id,
    status: pedido.status,
    subtotal: pedido.subtotal,
    couponCode: pedido.couponCode,
    discountAmount: pedido.discountAmount,
    shippingCost: pedido.shippingCost,
    total: pedido.total,
    customerName: pedido.customerName,
    customerEmail: pedido.customerEmail,
    shippingCity: pedido.shippingCity,
    notes: pedido.notes,
    paymentProvider: pedido.paymentProvider,
    paymentStatus: pedido.paymentStatus,
    paymentPreferenceId: pedido.paymentPreferenceId,
    paymentId: pedido.paymentId,
    createdAt: pedido.createdAt,
    items: items.map((item) => ({
      id: item.id,
      productoId: item.productoId,
      title: item.title,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  };
}

pedidosRoutes.use("*", authMiddleware);

pedidosRoutes.post("/", async (c: PedidoContext) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");
  const body = await c.req.json<{
    items?: CheckoutItemInput[];
    notes?: string;
    paymentProvider?: PaymentProvider;
    deliveryMethod?: DeliveryMethod;
    couponCode?: string;
  }>();

  const rawItems = body.items ?? [];
  if (!rawItems.length) {
    return c.json({ error: "El carrito está vacío" }, 400);
  }

  const merged = new Map<string, number>();
  for (const item of rawItems) {
    if (!item.productoId || typeof item.productoId !== "string") continue;
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty < 1) continue;
    merged.set(item.productoId, (merged.get(item.productoId) ?? 0) + Math.floor(qty));
  }

  if (!merged.size) {
    return c.json({ error: "Items inválidos" }, 400);
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !user.isActive) {
    return c.json({ error: "Usuario no encontrado" }, 404);
  }

  const productRows = await db.select().from(productos).all();
  const productById = new Map(productRows.map((row) => [row.id, row]));

  const lineItems: {
    productoId: string;
    title: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    newStock: number;
  }[] = [];

  for (const [productoId, quantity] of merged.entries()) {
    const producto = productById.get(productoId);
    if (!producto || producto.status === "draft") {
      return c.json({ error: `Producto no disponible: ${productoId}` }, 400);
    }
    if (producto.stock < quantity) {
      return c.json({ error: `Stock insuficiente para "${producto.title}"` }, 409);
    }

    const newStock = producto.stock - quantity;
    lineItems.push({
      productoId,
      title: producto.title,
      unitPrice: producto.price,
      quantity,
      lineTotal: producto.price * quantity,
      newStock,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const couponResult = await resolveCoupon(db, body.couponCode, subtotal, itemQuantity);
  if (couponResult.error) return c.json({ error: couponResult.error }, 400);
  const deliveryMethod = resolveDeliveryMethod(body.deliveryMethod);
  const { shippingCost, shippingCity } = deliveryDetails(deliveryMethod);
  const total = subtotal - couponResult.discountAmount + shippingCost;
  const now = new Date();
  const pedidoId = generateId();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;
  const paymentProvider: PaymentProvider = body.paymentProvider === "mercadopago" ? "mercadopago" : "manual";

  await db.insert(pedidos).values({
    id: pedidoId,
    userId,
    status: "pending",
    subtotal,
    couponCode: couponResult.code,
    discountAmount: couponResult.discountAmount,
    shippingCost,
    total,
    customerName: user.name,
    customerEmail: user.email,
    shippingCity,
    notes,
    paymentProvider,
    paymentStatus: paymentProvider === "mercadopago" ? "pending" : "not_started",
    createdAt: now,
    updatedAt: now,
  }).run();

  let claimedCouponId: string | null = null;
  if (couponResult.coupon) {
    const coupon = couponResult.coupon;
    const claim = await db
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: now })
      .where(
        coupon.usageLimit === null
          ? and(eq(coupons.id, coupon.id), eq(coupons.isActive, true))
          : and(
              eq(coupons.id, coupon.id),
              eq(coupons.isActive, true),
              lt(coupons.usedCount, coupon.usageLimit),
            ),
      )
      .returning({ id: coupons.id })
      .get();
    if (!claim) {
      await deletePedido(db, pedidoId);
      return c.json({ error: "El cupón alcanzó su límite de usos" }, 409);
    }
    claimedCouponId = coupon.id;
    const couponId = claimedCouponId;
    try {
      await db.insert(couponRedemptions).values({
        id: generateId(), couponId, pedidoId, userId,
        discountAmount: couponResult.discountAmount, createdAt: now,
      }).run();
    } catch (error) {
      await releaseCouponUse(db, couponId);
      await deletePedido(db, pedidoId);
      throw error;
    }
  }

  const shouldReserveStock = paymentProvider === "manual";
  const reservedItems: typeof lineItems = [];

  try {
    for (const item of lineItems) {
      await db.insert(pedidoItems).values({
        id: generateId(),
        pedidoId,
        productoId: item.productoId,
        title: item.title,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      }).run();

      if (shouldReserveStock) {
        await db
          .update(productos)
          .set({
            stock: item.newStock,
            updatedAt: now,
          })
          .where(eq(productos.id, item.productoId))
          .run();
        reservedItems.push(item);
      }
    }
  } catch (error) {
    if (reservedItems.length > 0) {
      await rollbackPedidoReservation(db, pedidoId, reservedItems);
    } else {
      await deletePedido(db, pedidoId);
    }
    if (claimedCouponId) await releaseCouponUse(db, claimedCouponId);
    throw error;
  }

  const savedItems = await db
    .select()
    .from(pedidoItems)
    .where(eq(pedidoItems.pedidoId, pedidoId))
    .all();
  const pedido = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId)).get();

  if (!pedido) {
    return c.json({ error: "No se pudo crear el pedido" }, 500);
  }

  if (paymentProvider === "mercadopago") {
    try {
      const origin = new URL(c.req.url).origin;
      const notificationUrl =
        c.env.MERCADOPAGO_WEBHOOK_URL?.trim() || `${origin}/api/payments/mercadopago/webhook`;
      const preference = await createMercadoPagoPreference({
        accessToken: c.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
        appUrl: c.env.APP_URL ?? "https://lamesasocial.com.ar",
        notificationUrl,
        pedidoId: pedido.id,
        payer: {
          name: pedido.customerName,
          email: pedido.customerEmail,
        },
        items: pedido.discountAmount > 0
          ? [{
              id: `pedido-${pedido.id}`,
              title: `Pedido La Mesa Social (${pedido.couponCode})`,
              quantity: 1,
              unit_price: pedido.total,
              currency_id: "ARS" as const,
            }]
          : [
          ...savedItems.map((item) => ({
            id: item.productoId,
            title: item.title,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            currency_id: "ARS" as const,
          })),
          ...(pedido.shippingCost > 0
            ? [
                {
                  id: "shipping-mdq",
                  title: `Envío a ${pedido.shippingCity}`,
                  quantity: 1,
                  unit_price: pedido.shippingCost,
                  currency_id: "ARS" as const,
                },
              ]
            : []),
        ],
      });

      await db
        .update(pedidos)
        .set({
          paymentPreferenceId: preference.id,
          paymentInitPoint: preference.init_point,
          updatedAt: new Date(),
        })
        .where(eq(pedidos.id, pedido.id))
        .run();

      const updatedPedido = await db.select().from(pedidos).where(eq(pedidos.id, pedido.id)).get();

      const useSandbox = c.env.MERCADOPAGO_USE_SANDBOX === "true";
      const initPoint = useSandbox && preference.sandbox_init_point
        ? preference.sandbox_init_point
        : preference.init_point;

      return c.json(
        {
          pedido: formatPedidoResponse(updatedPedido ?? pedido, savedItems),
          payment: {
            provider: "mercadopago",
            preferenceId: preference.id,
            initPoint,
            sandboxInitPoint: preference.sandbox_init_point,
          },
        },
        201,
      );
    } catch (error) {
      await deletePedido(db, pedido.id);
      if (claimedCouponId) await releaseCouponUse(db, claimedCouponId);
      throw error;
    }
  }

  const emailConfig = resolveEmailConfig(c.env);
  if (emailConfig) {
    const emailContent = {
      customerName: pedido.customerName,
      customerEmail: pedido.customerEmail,
      orderId: pedido.id,
      items: savedItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: pedido.subtotal,
      couponCode: pedido.couponCode,
      discountAmount: pedido.discountAmount,
      shippingCost: pedido.shippingCost,
      total: pedido.total,
      shippingCity: pedido.shippingCity,
      notes: pedido.notes,
      appUrl: emailConfig.appUrl,
      logoUrl: emailConfig.logoUrl,
    };

    c.executionCtx.waitUntil(
      Promise.all([
        sendOrderConfirmationEmail(emailConfig, emailContent).catch((error) => {
          console.error("Order confirmation email failed:", error);
        }),
        sendOrderAdminEmail(emailConfig, c.env.ORDERS_ADMIN_EMAIL, emailContent).catch((error) => {
          console.error("Order admin email failed:", error);
        }),
      ]),
    );
  }

  return c.json({ pedido: formatPedidoResponse(pedido, savedItems) }, 201);
});

pedidosRoutes.get("/mine", async (c: PedidoContext) => {
  const db = createDbClient(c.env.DB);
  const userId = c.get("userId");

  const rows = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.userId, userId))
    .orderBy(desc(pedidos.createdAt))
    .all();

  const result = [];
  for (const pedido of rows) {
    const items = await db
      .select()
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, pedido.id))
      .all();
    result.push(formatPedidoResponse(pedido, items));
  }

  return c.json({ pedidos: result });
});

pedidosRoutes.get("/admin/all", adminOnly, async (c: PedidoContext) => {
  const db = createDbClient(c.env.DB);

  const rows = await db.select().from(pedidos).orderBy(desc(pedidos.createdAt)).all();
  const result = [];
  for (const pedido of rows) {
    const items = await db
      .select()
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, pedido.id))
      .all();
    result.push(formatPedidoResponse(pedido, items));
  }

  return c.json({ pedidos: result });
});

pedidosRoutes.patch("/:id/status", adminOnly, async (c: PedidoContext) => {
  const db = createDbClient(c.env.DB);
  const pedidoId = c.req.param("id");
  if (!pedidoId) {
    return c.json({ error: "Pedido id required" }, 400);
  }

  const body = await c.req.json<{ status?: PedidoStatus }>();
  const allowed: PedidoStatus[] = ["pending", "confirmed", "cancelled", "fulfilled"];
  if (!body.status || !allowed.includes(body.status)) {
    return c.json({ error: "Estado inválido" }, 400);
  }

  const existing = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId)).get();
  if (!existing) {
    return c.json({ error: "Pedido not found" }, 404);
  }

  const now = new Date();
  await db
    .update(pedidos)
    .set({ status: body.status, updatedAt: now })
    .where(eq(pedidos.id, pedidoId))
    .run();

  const pedido = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId)).get();
  const items = await db
    .select()
    .from(pedidoItems)
    .where(eq(pedidoItems.pedidoId, pedidoId))
    .all();

  if (!pedido) {
    return c.json({ error: "Pedido not found" }, 404);
  }

  return c.json({ pedido: formatPedidoResponse(pedido, items) });
});

export default pedidosRoutes;

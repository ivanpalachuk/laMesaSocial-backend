import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db";
import { pedidoItems, pedidos, productos } from "../db/schema";
import type { AppEnv } from "../middleware/auth";
import { fetchMercadoPagoPayment } from "../utils/mercadopago";

const paymentsRoutes = new Hono<AppEnv>();

type PaymentsContext = Context<AppEnv>;

function mapMercadoPagoPaymentStatus(status: string): {
  paymentStatus: string;
  pedidoStatus: "pending" | "confirmed" | "cancelled" | "fulfilled";
} {
  if (status === "approved") {
    return { paymentStatus: "approved", pedidoStatus: "confirmed" };
  }

  if (status === "rejected" || status === "cancelled") {
    return { paymentStatus: status, pedidoStatus: "cancelled" };
  }

  if (status === "refunded" || status === "charged_back") {
    return { paymentStatus: status, pedidoStatus: "cancelled" };
  }

  return { paymentStatus: status || "pending", pedidoStatus: "pending" };
}

function extractPaymentId(c: PaymentsContext, body: unknown): string | null {
  const dataId = c.req.query("data.id");
  if (dataId) return dataId;

  const id = c.req.query("id");
  if (id) return id;

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.id === "string" || typeof record.id === "number") {
      return String(record.id);
    }

    if (record.data && typeof record.data === "object") {
      const data = record.data as Record<string, unknown>;
      if (typeof data.id === "string" || typeof data.id === "number") {
        return String(data.id);
      }
    }
  }

  return null;
}

async function reservePedidoStock(db: ReturnType<typeof createDbClient>, pedidoId: string): Promise<boolean> {
  const pedido = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId)).get();
  if (!pedido) return false;
  if (pedido.status === "confirmed" || pedido.status === "fulfilled") return true;

  const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedidoId, pedidoId)).all();

  for (const item of items) {
    const product = await db.select().from(productos).where(eq(productos.id, item.productoId)).get();
    if (!product || product.status === "draft" || product.stock < item.quantity) {
      return false;
    }
  }

  const now = new Date();
  for (const item of items) {
    const product = await db.select().from(productos).where(eq(productos.id, item.productoId)).get();
    if (!product) return false;

    const newStock = product.stock - item.quantity;
    await db
      .update(productos)
      .set({
        stock: newStock,
        updatedAt: now,
      })
      .where(eq(productos.id, item.productoId))
      .run();
  }

  return true;
}

paymentsRoutes.post("/mercadopago/webhook", async (c: PaymentsContext) => {
  const type = c.req.query("type") || c.req.query("topic");
  let body: unknown = null;

  try {
    body = await c.req.json();
  } catch {
    body = null;
  }

  if (type && type !== "payment") {
    return c.json({ received: true, ignored: type });
  }

  const paymentId = extractPaymentId(c, body);
  if (!paymentId) {
    return c.json({ received: true, ignored: "missing_payment_id" });
  }

  const payment = await fetchMercadoPagoPayment(c.env.MERCADOPAGO_ACCESS_TOKEN, paymentId);
  const pedidoId = payment.external_reference;

  if (!pedidoId) {
    return c.json({ received: true, ignored: "missing_external_reference" });
  }

  const { paymentStatus, pedidoStatus } = mapMercadoPagoPaymentStatus(payment.status);
  const db = createDbClient(c.env.DB);
  const now = new Date();
  const canConfirm = pedidoStatus !== "confirmed" || await reservePedidoStock(db, pedidoId);
  const finalPedidoStatus = canConfirm ? pedidoStatus : "pending";
  const finalPaymentStatus = canConfirm ? paymentStatus : "approved_stock_conflict";

  await db
    .update(pedidos)
    .set({
      status: finalPedidoStatus,
      paymentProvider: "mercadopago",
      paymentStatus: finalPaymentStatus,
      paymentId: String(payment.id),
      paymentLastPayload: JSON.stringify({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        external_reference: payment.external_reference,
        stock_reserved: canConfirm,
      }),
      updatedAt: now,
    })
    .where(eq(pedidos.id, pedidoId))
    .run();

  return c.json({ received: true });
});

export default paymentsRoutes;

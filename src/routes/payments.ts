import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db";
import { pedidos } from "../db/schema";
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

  await db
    .update(pedidos)
    .set({
      status: pedidoStatus,
      paymentProvider: "mercadopago",
      paymentStatus,
      paymentId: String(payment.id),
      paymentLastPayload: JSON.stringify({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        external_reference: payment.external_reference,
      }),
      updatedAt: now,
    })
    .where(eq(pedidos.id, pedidoId))
    .run();

  return c.json({ received: true });
});

export default paymentsRoutes;

import { eq } from "drizzle-orm";
import type { createDbClient } from "../db";
import { coupons } from "../db/schema";

export type Coupon = typeof coupons.$inferSelect;
export type ResolvedCoupon = {
  code: string | null;
  coupon: Coupon | null;
  discountAmount: number;
  error?: string;
};

export function normalizeCouponCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
}

export function calculateCouponDiscount(coupon: Coupon, subtotal: number, now = new Date()) {
  if (!coupon.isActive) return { error: "El cupón no está activo" } as const;
  if (coupon.startsAt && coupon.startsAt > now) return { error: "El cupón todavía no está vigente" } as const;
  if (coupon.expiresAt && coupon.expiresAt < now) return { error: "El cupón venció" } as const;
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { error: "El cupón alcanzó su límite de usos" } as const;
  }
  if (coupon.minimumSubtotal !== null && subtotal < coupon.minimumSubtotal) {
    return { error: `El subtotal mínimo para este cupón es $${coupon.minimumSubtotal.toLocaleString("es-AR")}` } as const;
  }

  let discountAmount = coupon.discountType === "percentage"
    ? Math.floor((subtotal * coupon.discountValue) / 100)
    : coupon.discountValue;
  if (coupon.discountType === "percentage" && coupon.maximumDiscount !== null) {
    discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);
  if (discountAmount < 1) return { error: "El cupón no genera un descuento válido" } as const;
  return { discountAmount } as const;
}

export async function resolveCoupon(
  db: ReturnType<typeof createDbClient>,
  rawCode: unknown,
  subtotal: number,
): Promise<ResolvedCoupon> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { code: null, coupon: null, discountAmount: 0 };
  const coupon = await db.select().from(coupons).where(eq(coupons.code, code)).get();
  if (!coupon) return { code, coupon: null, discountAmount: 0, error: "Cupón inválido" };
  const result = calculateCouponDiscount(coupon, subtotal);
  if ("error" in result) return { code, coupon, discountAmount: 0, error: result.error };
  return { code, coupon, discountAmount: result.discountAmount };
}

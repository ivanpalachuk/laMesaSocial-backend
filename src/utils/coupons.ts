import { eq } from "drizzle-orm";
import type { createDbClient } from "../db";
import { coupons } from "../db/schema";
import { calculateCouponDiscount } from "./coupon-discount";

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

export async function resolveCoupon(
  db: ReturnType<typeof createDbClient>,
  rawCode: unknown,
  subtotal: number,
  itemQuantity: number,
): Promise<ResolvedCoupon> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { code: null, coupon: null, discountAmount: 0 };
  const coupon = await db.select().from(coupons).where(eq(coupons.code, code)).get();
  if (!coupon) return { code, coupon: null, discountAmount: 0, error: "Cupón inválido" };
  const result = calculateCouponDiscount(coupon, subtotal, itemQuantity);
  if ("error" in result) return { code, coupon, discountAmount: 0, error: result.error };
  return { code, coupon, discountAmount: result.discountAmount };
}

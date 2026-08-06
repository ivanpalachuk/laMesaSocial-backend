export type DiscountableCoupon = {
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumSubtotal: number | null;
  maximumDiscount: number | null;
  maximumQuantity: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
};

export function calculateCouponDiscount(
  coupon: DiscountableCoupon,
  subtotal: number,
  itemQuantity: number,
  now = new Date(),
) {
  if (!coupon.isActive) return { error: "El cupón no está activo" } as const;
  if (coupon.startsAt && coupon.startsAt > now) return { error: "El cupón todavía no está vigente" } as const;
  if (coupon.expiresAt && coupon.expiresAt < now) return { error: "El cupón venció" } as const;
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { error: "El cupón alcanzó su límite de usos" } as const;
  }
  if (coupon.minimumSubtotal !== null && subtotal < coupon.minimumSubtotal) {
    return { error: `El subtotal mínimo para este cupón es $${coupon.minimumSubtotal.toLocaleString("es-AR")}` } as const;
  }

  // ponytail: volume tiers are linear and capped; add explicit tier rows only for non-linear campaigns.
  const percentage = coupon.maximumQuantity === null
    ? coupon.discountValue
    : coupon.discountValue * Math.min(itemQuantity, coupon.maximumQuantity);
  let discountAmount = coupon.discountType === "percentage"
    ? Math.floor((subtotal * percentage) / 100)
    : coupon.discountValue;
  if (coupon.discountType === "percentage" && coupon.maximumDiscount !== null) {
    discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);
  if (discountAmount < 1) return { error: "El cupón no genera un descuento válido" } as const;
  return { discountAmount } as const;
}

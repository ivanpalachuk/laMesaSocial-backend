import assert from "node:assert/strict";
import test from "node:test";
import type { DiscountableCoupon } from "../src/utils/coupon-discount.ts";
import { calculateCouponDiscount } from "../src/utils/coupon-discount.ts";

const coupon: DiscountableCoupon = {
  discountType: "percentage",
  discountValue: 5,
  minimumSubtotal: null,
  maximumDiscount: null,
  maximumQuantity: 3,
  usageLimit: null,
  usedCount: 0,
  startsAt: null,
  expiresAt: null,
  isActive: true,
};

test("volume coupon increases by item quantity and stops at its configured tier", () => {
  assert.deepEqual(calculateCouponDiscount(coupon, 10_000, 1), { discountAmount: 500 });
  assert.deepEqual(calculateCouponDiscount(coupon, 10_000, 2), { discountAmount: 1_000 });
  assert.deepEqual(calculateCouponDiscount(coupon, 10_000, 3), { discountAmount: 1_500 });
  assert.deepEqual(calculateCouponDiscount(coupon, 10_000, 4), { discountAmount: 1_500 });
});

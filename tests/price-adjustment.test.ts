import assert from "node:assert/strict";
import test from "node:test";
import { priceMultiplierFromPercentage } from "../src/utils/price-adjustment.ts";

test("accepts positive percentages and rejects unsafe values", () => {
  assert.equal(priceMultiplierFromPercentage(10), 1.1);
  assert.equal(priceMultiplierFromPercentage(12.5), 1.125);
  assert.equal(priceMultiplierFromPercentage(0), null);
  assert.equal(priceMultiplierFromPercentage(-5), null);
  assert.equal(priceMultiplierFromPercentage(1001), null);
  assert.equal(priceMultiplierFromPercentage("10"), null);
});

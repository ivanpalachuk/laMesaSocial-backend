import assert from "node:assert/strict";
import test from "node:test";
import { allocateProductSlug, slugifyProductTitle } from "../src/utils/product-slug.ts";

test("slugifyProductTitle normalizes names for public URLs", () => {
  assert.equal(slugifyProductTitle("  Código Secreto: Dúo  "), "codigo-secreto-duo");
  assert.equal(slugifyProductTitle("7 Wonders & Duel"), "7-wonders-duel");
  assert.equal(slugifyProductTitle("¡¿?!"), "juego");
});

test("allocateProductSlug uses the first available numeric suffix", () => {
  assert.equal(allocateProductSlug("Catan", []), "catan");
  assert.equal(allocateProductSlug("Catan", ["catan", "catan-2", "catan-4"]), "catan-3");
});

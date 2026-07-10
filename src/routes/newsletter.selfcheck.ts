import { normalizeNewsletterEmail } from "./newsletter-validation.ts";

const cases: Array<[unknown, string | null]> = [
  ["  JUGADOR@Example.COM ", "jugador@example.com"],
  ["sin-arroba", null],
  ["a@b", null],
  [null, null],
];

for (const [input, expected] of cases) {
  const actual = normalizeNewsletterEmail(input);
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

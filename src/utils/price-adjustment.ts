export function priceMultiplierFromPercentage(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1000) {
    return null;
  }

  return 1 + value / 100;
}

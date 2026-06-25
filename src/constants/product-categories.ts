/** Categorías de productos/juegos — mantener en sync con lamesa-app PRODUCTO_CATEGORIES */
export const PRODUCTO_CATEGORIES = [
  "abstracto",
  "cartas",
  "cooperativo",
  "dados",
  "deduccion",
  "destreza",
  "estrategia",
  "eurogame",
  "familiar",
  "filler",
  "party",
  "rol",
  "otros",
] as const;

export type ProductoCategory = (typeof PRODUCTO_CATEGORIES)[number];

export function formatCategoryLabel(category: string): string {
  const value = category.trim();
  if (!value) return "Otros";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function parseGamerDna(raw: string | null | undefined): ProductoCategory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ProductoCategory =>
        typeof item === "string" && (PRODUCTO_CATEGORIES as readonly string[]).includes(item),
    );
  } catch {
    return [];
  }
}

export function serializeGamerDna(values: string[]): string {
  const normalized = values.filter((item) =>
    (PRODUCTO_CATEGORIES as readonly string[]).includes(item),
  );
  return JSON.stringify(normalized);
}

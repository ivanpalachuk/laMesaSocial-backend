export function slugifyProductTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "juego";
}

export function allocateProductSlug(title: string, usedSlugs: Iterable<string>): string {
  const base = slugifyProductTitle(title);
  const used = new Set(usedSlugs);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

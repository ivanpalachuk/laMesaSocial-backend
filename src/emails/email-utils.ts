export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "jugador/a";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

import type { AppEnv } from "../middleware/auth";

export type EventImageInput = {
  title: string;
  description: string | null;
  menuLudico: string | null;
  menuLudicoGames?: string[];
  location: string;
  startsAt: Date;
  endsAt: Date | null;
  maxSeats: number;
  pricePerPerson: number;
  status: "draft" | "published" | "cancelled";
};

export class EventImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventImageGenerationError";
  }
}

type WorkersAiImageResponse = {
  image?: string;
};

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_PROMPT_LENGTH = 2048;

function hasContent(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function compact(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

// ponytail: keyword inference avoids a new audience field; add an explicit form/API field if event types expand.
function isChildFriendlyEvent(event: EventImageInput) {
  const context = [event.title, event.description, event.menuLudico]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return /\b(infantil|ninos?|ninas?|chicos?|peques?|familias?|familiar)\b/.test(context);
}

function buildGameVisualHints(games: string[] | undefined) {
  const source = games?.join(" ").toLowerCase() ?? "";
  const hints = new Set<string>();

  if (source.includes("abstracto")) hints.add("tablero abstracto con piezas de colores");
  if (source.includes("cartas")) hints.add("cartas sin texto visible en abanico o sobre la mesa");
  if (source.includes("cooperativo")) hints.add("jugadores colaborando sobre un objetivo comun");
  if (source.includes("deduccion")) hints.add("personas conversando y observando pistas genericas");
  if (source.includes("dados")) hints.add("dados pequenos comunes, nunca gigantes");
  if (source.includes("eurogame") || source.includes("estrategia")) hints.add("tablero organizado con recursos, fichas y meeples");
  if (source.includes("familiar")) hints.add("mesa accesible y luminosa");
  if (source.includes("filler") || source.includes("party")) hints.add("cartas y componentes simples con clima distendido");

  return [...hints].slice(0, 4).join("; ");
}

export function shouldGenerateEventImage(event: EventImageInput) {
  return (
    hasContent(event.title) &&
    hasContent(event.description) &&
    hasContent(event.menuLudico) &&
    hasContent(event.location) &&
    Number.isFinite(event.startsAt.getTime()) &&
    event.maxSeats > 0 &&
    event.pricePerPerson >= 0
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

export function buildEventImagePrompt(event: EventImageInput) {
  const schedule = event.endsAt
    ? `${formatDateTime(event.startsAt)} hasta ${formatDateTime(event.endsAt)}`
    : formatDateTime(event.startsAt);
  const gameVisualHints = buildGameVisualHints([event.menuLudico ?? "", ...(event.menuLudicoGames ?? [])]);
  const eventMood = compact(event.description, 300);
  const audience = isChildFriendlyEvent(event)
    ? "Evento infantil o familiar: mostrar ninos jugando con personas adultas responsables cerca, en un ambiente seguro, alegre y apropiado para su edad."
    : "Encuentro social de personas adultas jugando y conversando en un ambiente de cafeteria o espacio comunitario.";

  const prompt = [
    "Fotografia documental horizontal 16:9 de una mesa real de juegos de mesa. Imagen natural, tomada con camara, no disenio grafico.",
    audience,
    "La escena debe parecer una foto candid de comunidad: manos moviendo piezas, personas conversando fuera de foco, tablero desplegado, cartas o fichas genericas, comida simple y bebidas sin alcohol si el plan es relajado.",
    "No mostrar alcohol bajo ninguna circunstancia: sin cerveza, vino, tragos, botellas, latas, copas ni vasos que parezcan bebidas alcoholicas.",
    "Usar el contexto solo para elegir clima y componentes, no escribirlo en la imagen.",
    `Clima del encuentro: ${eventMood}.`,
    gameVisualHints ? `Pistas visuales de componentes: ${gameVisualHints}.` : "Componentes genericos de juegos modernos, sin marcas.",
    `Horario para luz y ambiente: ${schedule}; lugar: ${compact(event.location, 90)}.`,
    "Si es manana, luz natural suave. Si es tarde o merienda, mesa luminosa con agua, jugo, cafe, te, medialunas o budin. Si es noche, luz calida de cafeteria. Si es party, mas manos, cartas y risas. Si es estrategia, tablero ordenado y concentracion.",
    "Composicion como ejemplo: primer plano de mesa con comida o bebida sin alcohol y un tablero al centro; profundidad de campo suave; personas parcialmente visibles; colores calidos tierra, crema, naranja suave y verde petroleo.",
    "No crear flyer, poster, cartel, collage, mockup, menu, invitacion, placa de Instagram, badge, logo ni layout con espacios para texto.",
    "Cero texto visible: sin letras, palabras, numeros, titulos, fechas, precios, carteles, etiquetas, menus, QR, marcas, nombres de juegos, texto en cartas, texto en cajas ni texto en el tablero.",
    "Evitar dados gigantes, casino, apuestas, iconos, ilustracion vectorial o componentes imposibles. Todo debe verse fisico, cotidiano y fotografico.",
  ].join("\n");
  return prompt.length > MAX_PROMPT_LENGTH ? prompt.slice(0, MAX_PROMPT_LENGTH) : prompt;
}

export async function generateEventImagePreview(
  event: EventImageInput,
  env: AppEnv["Bindings"],
): Promise<{ data: string; mimeType: string } | null> {
  if (!shouldGenerateEventImage(event)) {
    return null;
  }

  let response: WorkersAiImageResponse;
  try {
    response = (await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: buildEventImagePrompt(event),
    })) as WorkersAiImageResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Workers AI error";
    console.error("Workers AI image generation failed:", message);
    throw new EventImageGenerationError(`Workers AI failed: ${message}`);
  }

  const imageData = response.image;
  const mimeType = "image/jpeg";
  const extension = IMAGE_MIME_EXT[mimeType];
  if (!imageData || !extension) {
    console.error("Workers AI returned no supported image");
    throw new EventImageGenerationError("Workers AI returned no supported output image");
  }

  return { data: imageData, mimeType };
}

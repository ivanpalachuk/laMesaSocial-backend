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

  const prompt = [
    "Fotografia documental horizontal 16:9 de una mesa real de juegos de mesa en un encuentro social adulto. Imagen natural, tomada con camara, no disenio grafico.",
    "La escena debe parecer una foto candid de comunidad: manos moviendo piezas, personas conversando fuera de foco, tablero desplegado, cartas o fichas genericas, bebidas y algo para compartir si el plan es relajado.",
    "Usar el contexto solo para elegir clima y componentes, no escribirlo en la imagen.",
    `Clima del encuentro: ${eventMood}.`,
    gameVisualHints ? `Pistas visuales de componentes: ${gameVisualHints}.` : "Componentes genericos de juegos modernos, sin marcas.",
    `Horario para luz y ambiente: ${schedule}; lugar: ${compact(event.location, 90)}.`,
    "Si es manana, luz natural suave. Si es tarde o merienda, mesa luminosa con cafe, te, medialunas o budin. Si es noche, luz calida de bar/cafe. Si es party, mas manos, cartas y risas. Si es estrategia, tablero ordenado y concentracion.",
    "Composicion como ejemplo: primer plano de mesa con comida/bebida y un tablero al centro; profundidad de campo suave; personas parcialmente visibles; colores calidos tierra, crema, naranja suave y verde petroleo.",
    "No crear flyer, poster, cartel, collage, mockup, menu, invitacion, placa de Instagram, badge, logo ni layout con espacios para texto.",
    "Cero texto visible: sin letras, palabras, numeros, titulos, fechas, precios, carteles, etiquetas, menus, QR, marcas, nombres de juegos, texto en cartas, texto en cajas ni texto en el tablero.",
    "Evitar dados gigantes, casino, apuestas, estetica infantil, iconos, ilustracion vectorial o componentes imposibles. Todo debe verse fisico, cotidiano y fotografico.",
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

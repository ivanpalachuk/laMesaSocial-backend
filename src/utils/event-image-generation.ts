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
  const games = compact(event.menuLudicoGames?.filter((game) => game.trim()).slice(0, 4).join("; "), 360);

  const prompt = [
    "Imagen horizontal 16:9 editorial y fotografica para evento real de juegos de mesa de La Mesa Social. No es flyer, no es poster, no es collage, no es stock photo.",
    `Evento: ${compact(event.title, 120)}.`,
    `Descripcion: ${compact(event.description, 260)}.`,
    `Propuesta ludica: ${compact(event.menuLudico, 220)}.`,
    games ? `Juegos: ${games}.` : "Juegos: no especificados.",
    `Lugar y horario: ${compact(event.location, 90)}; ${schedule}. Cupos ${event.maxSeats}. Precio ${event.pricePerPerson}.`,
    "Interpretar hora+descripcion: manana=luz natural suave; tarde/merienda=mesa luminosa, cafe/te, merienda simple; noche=luz calida de bar/cafe; finde=plan social distendido.",
    "Si es relajado, mostrar conversacion y juegos tranquilos; si es party, risas/grupos/cartas; si es estrategia, mesa concentrada con tableros organizados; si es accesible/fin de mes, calidez comunitaria sin lujo.",
    "Direccion visual: fotografia editorial realista, calida y cuidada; adultos jugando en mesa, bebidas, componentes de juegos, comunidad, profundidad de campo suave, encuadre limpio para card web.",
    "Composicion: una escena real de mesa compartida con identidad La Mesa Social, sin elementos graficos superpuestos; dejar una zona con menos detalle para que la web pueda poner texto encima.",
    "Paleta: #5d4037 tierra, #f57c00 naranja, #fbf9f5 crema, #005049 teal; negro calido solo si corresponde noche.",
    "Prohibido generar texto, letras, palabras, numeros, carteles, titulares, menus, QR, logos, marcas o nombres de juegos visibles. Sin casino, apuestas, flyer infantil ni dados gigantes.",
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

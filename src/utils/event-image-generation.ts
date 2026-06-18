import type { AppEnv } from "../middleware/auth";

export type EventImageInput = {
  title: string;
  description: string | null;
  menuLudico: string | null;
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

function hasContent(value: string | null | undefined) {
  return Boolean(value?.trim());
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

  return [
    "Genera una imagen horizontal 16:9 para promocionar un encuentro de juegos de mesa de La Mesa Social.",
    "Estilo: fotografia editorial calida y realista, mesa compartida, juegos de mesa modernos, personas socializando, ambiente cercano e inclusivo.",
    "Marca: usar una paleta inspirada en el logo y la web: marron tierra #5d4037, naranja #f57c00, fondo claro #fbf9f5 y acentos teal #005049. Evitar paletas frias genericas.",
    "Filosofia: comunidad, juego compartido, bienvenida, calma y disfrute; no debe parecer casino, apuesta, competencia agresiva ni evento corporativo.",
    "Composicion: dejar espacio limpio para texto superpuesto en la web, sin generar texto legible, logos, marcas registradas ni dados gigantes.",
    `Titulo del encuentro: ${event.title.trim()}.`,
    `Descripcion: ${event.description?.trim()}.`,
    `Menu ludico o propuesta: ${event.menuLudico?.trim()}.`,
    `Lugar: ${event.location.trim()}.`,
    `Fecha y horario: ${schedule}.`,
    `Cupos: ${event.maxSeats}. Precio por persona: ${event.pricePerPerson}.`,
  ].join("\n");
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

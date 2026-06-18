// @ts-ignore: ponytail: Node 24 strip-types self-check imports the TS source directly; no build step.
const { buildEventImagePrompt, shouldGenerateEventImage } = (await import("./event-image-generation.ts")) as typeof import("./event-image-generation");

const completeEvent = {
  id: "event-1",
  title: "Noche de juegos",
  description: "Una mesa abierta para jugar y conocer gente.",
  menuLudico: "Catan, Azul y party games.",
  menuLudicoGames: ["Azul | 2-4 jugadores | 45 min | dificultad 2 | categorias: familiar, abstracto"],
  location: "Mar del Plata",
  startsAt: new Date("2026-07-20T22:00:00.000Z"),
  endsAt: null,
  maxSeats: 16,
  pricePerPerson: 12000,
  status: "published" as const,
};

function assert(value: unknown, message: string) {
  if (!value) {
    throw new Error(message);
  }
}

assert(shouldGenerateEventImage(completeEvent), "complete published event should request an image");
assert(
  !shouldGenerateEventImage({ ...completeEvent, description: "" }),
  "missing description should skip image generation",
);
assert(
  buildEventImagePrompt(completeEvent).includes("#5d4037") &&
    buildEventImagePrompt(completeEvent).includes("#f57c00"),
  "prompt should include brand colors",
);
assert(
  buildEventImagePrompt(completeEvent).includes("no abstracta") &&
    buildEventImagePrompt(completeEvent).includes("Azul | 2-4 jugadores"),
  "prompt should force concrete event interpretation and include selected games",
);
assert(
  buildEventImagePrompt(completeEvent).includes("Interpretar hora+descripcion") &&
    buildEventImagePrompt(completeEvent).includes("badge central"),
  "prompt should ask for a contextual La Mesa Social poster-like visual direction",
);
assert(
  buildEventImagePrompt({
    ...completeEvent,
    description: "descripcion larga ".repeat(200),
    menuLudico: "propuesta larga ".repeat(200),
    menuLudicoGames: Array.from({ length: 12 }, (_, index) => `Juego ${index + 1} | 2-6 jugadores | 60 min | categorias: party, familiar`),
  }).length <= 2048,
  "prompt should fit Workers AI 2048 character limit",
);

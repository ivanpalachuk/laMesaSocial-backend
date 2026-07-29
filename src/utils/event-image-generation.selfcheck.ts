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
  buildEventImagePrompt(completeEvent).includes("colores calidos tierra") &&
    buildEventImagePrompt(completeEvent).includes("verde petroleo"),
  "prompt should include brand-adjacent color mood without hex text",
);
assert(
  buildEventImagePrompt(completeEvent).includes("Fotografia documental") &&
    buildEventImagePrompt(completeEvent).includes("tablero abstracto con piezas de colores") &&
    !buildEventImagePrompt(completeEvent).includes("Azul") &&
    !buildEventImagePrompt(completeEvent).includes("2-4 jugadores"),
  "prompt should force photographic event interpretation and convert selected games into generic visual hints",
);
assert(
  buildEventImagePrompt(completeEvent).includes("Usar el contexto solo para elegir clima") &&
    buildEventImagePrompt(completeEvent).includes("primer plano de mesa con comida o bebida sin alcohol"),
  "prompt should use event data as visual context instead of rendered copy",
);
assert(
  buildEventImagePrompt(completeEvent).includes("No mostrar alcohol bajo ninguna circunstancia") &&
    buildEventImagePrompt(completeEvent).includes("sin cerveza"),
  "prompt should never request alcohol",
);
assert(
  buildEventImagePrompt({
    ...completeEvent,
    title: "Tarde infantil",
    description: "Juegos para niñas y niños con sus familias.",
  }).includes("Evento infantil o familiar") &&
    !buildEventImagePrompt({
      ...completeEvent,
      title: "Tarde infantil",
      description: "Juegos para niñas y niños con sus familias.",
    }).includes("Encuentro social de personas adultas"),
  "child-friendly events should request an age-appropriate family scene",
);
assert(
  buildEventImagePrompt(completeEvent).includes("Cero texto visible") &&
    !buildEventImagePrompt(completeEvent).includes("badge central") &&
    !buildEventImagePrompt(completeEvent).includes("tipo ticket/info") &&
    !buildEventImagePrompt(completeEvent).includes("Evento:") &&
    !buildEventImagePrompt(completeEvent).includes("Precio"),
  "prompt should avoid structured copy and poster artifacts that make the model invent text",
);
assert(
  buildEventImagePrompt(completeEvent).includes("tablero desplegado") &&
    buildEventImagePrompt(completeEvent).includes("sin letras, palabras, numeros"),
  "prompt should force visible board game context",
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

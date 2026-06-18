// @ts-ignore: ponytail: Node 24 strip-types self-check imports the TS source directly; no build step.
const { buildEventImagePrompt, shouldGenerateEventImage } = (await import("./event-image-generation.ts")) as typeof import("./event-image-generation");

const completeEvent = {
  id: "event-1",
  title: "Noche de juegos",
  description: "Una mesa abierta para jugar y conocer gente.",
  menuLudico: "Catan, Azul y party games.",
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

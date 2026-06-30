import { and, eq } from "drizzle-orm";
import type { createDbClient } from "../db";
import { users } from "../db/schema";
import {
  buildNewEventEmailHtml,
  buildNewEventEmailText,
} from "../emails/new-event-email";
import { resolveEmailConfig, type EmailConfig } from "./email";

type EncuentroRow = {
  id: string;
  title: string;
  location: string;
  startsAt: Date;
};

function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

async function sendNewEventEmail(
  config: EmailConfig,
  recipient: { email: string; name: string },
  event: EncuentroRow,
): Promise<void> {
  const content = {
    name: recipient.name,
    eventTitle: event.title,
    eventLocation: event.location,
    eventStartsAt: formatEventDate(event.startsAt),
    eventUrl: `${config.appUrl}/evento/${event.id}`,
    logoUrl: config.logoUrl,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.eventsFrom,
      to: [recipient.email],
      subject: `Nuevo evento: ${event.title} — La Mesa Social`,
      html: buildNewEventEmailHtml(content),
      text: buildNewEventEmailText(content),
    }),
  });

  if (!response.ok) {
    let details = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) details = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(`Event notification email failed: ${details}`);
  }
}

export async function notifySubscribersOfNewEvent(
  db: ReturnType<typeof createDbClient>,
  config: EmailConfig | null,
  event: EncuentroRow,
): Promise<void> {
  if (!config) return;

  const subscribers = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.notifyEvents, true)))
    .all();

  await Promise.allSettled(
    subscribers.map((subscriber) => sendNewEventEmail(config, subscriber, event)),
  );
}

export function scheduleNewEventNotifications(
  ctx: { env: Parameters<typeof resolveEmailConfig>[0]; executionCtx: ExecutionContext },
  db: ReturnType<typeof createDbClient>,
  event: EncuentroRow,
): void {
  const config = resolveEmailConfig(ctx.env);
  if (!config) return;

  ctx.executionCtx.waitUntil(
    notifySubscribersOfNewEvent(db, config, event).catch((error) => {
      console.error("New event notification batch failed:", error);
    }),
  );
}

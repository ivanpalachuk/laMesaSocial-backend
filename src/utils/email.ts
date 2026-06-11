import { buildWelcomeEmailHtml, buildWelcomeEmailText } from "../emails/welcome-email";
import {
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
} from "../emails/password-reset-email";
import {
  buildOrderAdminEmailHtml,
  buildOrderAdminEmailText,
  buildOrderConfirmationEmailHtml,
  buildOrderConfirmationEmailText,
  type OrderEmailContent,
} from "../emails/order-email";

type ResendSendResponse = {
  id?: string;
};

type ResendErrorResponse = {
  message?: string;
  name?: string;
};

export type EmailConfig = {
  apiKey: string;
  welcomeFrom: string;
  passwordResetFrom: string;
  ordersFrom: string;
  appUrl: string;
  logoUrl: string;
};

function buildFromAddress(name: string, email: string): string {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  if (!trimmedName) return trimmedEmail;
  return `${trimmedName} <${trimmedEmail}>`;
}

async function sendResendEmail(
  config: EmailConfig,
  payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  },
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    let details = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as ResendErrorResponse;
      if (body.message) details = body.message;
    } catch {
      // Keep status-only fallback.
    }
    throw new Error(`Resend email failed: ${details}`);
  }

  const data = (await response.json()) as ResendSendResponse;
  if (!data.id) {
    throw new Error("Resend email failed: missing message id");
  }
}

export async function sendWelcomeEmail(
  config: EmailConfig,
  recipientEmail: string,
  recipientName: string,
): Promise<void> {
  const content = {
    name: recipientName,
    appUrl: config.appUrl,
    logoUrl: config.logoUrl,
  };

  await sendResendEmail(config, {
    from: config.welcomeFrom,
    to: recipientEmail,
    subject: "¡Bienvenido/a a La Mesa Social!",
    html: buildWelcomeEmailHtml(content),
    text: buildWelcomeEmailText(content),
  });
}

export async function sendPasswordResetEmail(
  config: EmailConfig,
  recipientEmail: string,
  recipientName: string,
  resetToken: string,
): Promise<void> {
  const resetUrl = `${config.appUrl}/restablecer-contrasena?token=${encodeURIComponent(resetToken)}`;
  const content = {
    name: recipientName,
    resetUrl,
    logoUrl: config.logoUrl,
  };

  await sendResendEmail(config, {
    from: config.passwordResetFrom,
    to: recipientEmail,
    subject: "Restablecer tu contraseña — La Mesa Social",
    html: buildPasswordResetEmailHtml(content),
    text: buildPasswordResetEmailText(content),
  });
}

export async function sendOrderConfirmationEmail(
  config: EmailConfig,
  content: OrderEmailContent,
): Promise<void> {
  await sendResendEmail(config, {
    from: config.ordersFrom,
    to: content.customerEmail,
    subject: `Pedido recibido #${content.orderId.slice(0, 8).toUpperCase()} — La Mesa Social`,
    html: buildOrderConfirmationEmailHtml(content),
    text: buildOrderConfirmationEmailText(content),
  });
}

export async function sendOrderAdminEmail(
  config: EmailConfig,
  adminEmail: string | undefined,
  content: OrderEmailContent,
): Promise<void> {
  const recipient = adminEmail?.trim();
  if (!recipient) {
    console.warn("ORDERS_ADMIN_EMAIL not configured; skipping admin order notification");
    return;
  }

  await sendResendEmail(config, {
    from: config.ordersFrom,
    to: recipient,
    subject: `Nuevo pedido #${content.orderId.slice(0, 8).toUpperCase()} — ${content.customerName}`,
    html: buildOrderAdminEmailHtml({ ...content, customerEmail: content.customerEmail }),
    text: buildOrderAdminEmailText({ ...content, customerEmail: content.customerEmail }),
  });
}

const DEFAULT_LOGO_URL =
  "https://lamesasocial.com.ar/711309238_18087093581102996_1979510018140210310_n.jpg";

export function resolveEmailConfig(env: {
  RESEND_API_KEY?: string;
  RESEND_FROM_NAME?: string;
  RESEND_FROM_EMAIL?: string;
  PASSWORD_RESET_FROM_EMAIL?: string;
  ORDERS_FROM_EMAIL?: string;
  APP_URL?: string;
  EMAIL_LOGO_URL?: string;
  WELCOME_EMAIL_LOGO_URL?: string;
}): EmailConfig | null {
  if (!env.RESEND_API_KEY?.trim()) return null;
  if (!env.RESEND_FROM_EMAIL?.trim()) return null;

  const fromName = env.RESEND_FROM_NAME ?? "La Mesa Social";
  const welcomeEmail = env.RESEND_FROM_EMAIL.trim();
  const passwordResetEmail = (env.PASSWORD_RESET_FROM_EMAIL ?? "seguridad@lamesasocial.com.ar").trim();
  const ordersEmail = (env.ORDERS_FROM_EMAIL ?? welcomeEmail).trim();
  const logoUrl = (env.EMAIL_LOGO_URL ?? env.WELCOME_EMAIL_LOGO_URL ?? DEFAULT_LOGO_URL).trim();

  return {
    apiKey: env.RESEND_API_KEY.trim(),
    welcomeFrom: buildFromAddress(fromName, welcomeEmail),
    passwordResetFrom: buildFromAddress(fromName, passwordResetEmail),
    ordersFrom: buildFromAddress(fromName, ordersEmail),
    appUrl: (env.APP_URL ?? "https://lamesasocial.com.ar").replace(/\/$/, ""),
    logoUrl,
  };
}

/** @deprecated Use resolveEmailConfig */
export const resolveWelcomeEmailConfig = resolveEmailConfig;

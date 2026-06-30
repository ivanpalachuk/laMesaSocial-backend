import { escapeHtml, firstName } from "./email-utils";

export type OrderEmailItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderEmailContent = {
  customerName: string;
  customerEmail: string;
  orderId: string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shippingCity: string;
  notes?: string | null;
  appUrl: string;
  logoUrl: string;
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

function renderItemsRows(items: OrderEmailItem[]): string {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e4e2de;color:#442a22;font-size:15px;">${escapeHtml(item.title)}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #e4e2de;color:#504441;font-size:15px;text-align:center;">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e4e2de;color:#442a22;font-size:15px;text-align:right;font-weight:700;">${formatMoney(item.lineTotal)}</td>
        </tr>`,
    )
    .join("");
}

export function buildOrderConfirmationEmailHtml(content: OrderEmailContent): string {
  const safeName = escapeHtml(firstName(content.customerName));
  const safeOrderId = escapeHtml(content.orderId.slice(0, 8).toUpperCase());
  const safeCity = escapeHtml(content.shippingCity);
  const safeNotes = content.notes?.trim() ? escapeHtml(content.notes.trim()) : "";
  const safeAppUrl = escapeHtml(content.appUrl);
  const safeLogoUrl = escapeHtml(content.logoUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pedido recibido — La Mesa Social</title>
</head>
<body style="margin:0;padding:0;background-color:#fbf9f5;font-family:Arial,Helvetica,sans-serif;color:#442a22;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fbf9f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #d4c3be;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(180deg,#fff8ef 0%,#ffffff 100%);">
              <img src="${safeLogoUrl}" alt="La Mesa Social" width="88" height="88" style="display:block;margin:0 auto 16px;border-radius:50%;border:3px solid #fea619;" />
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#855300;">La Mesa Social</p>
              <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#442a22;">¡Pedido recibido, ${safeName}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#504441;">
                Registramos tu pedido <strong>#${safeOrderId}</strong>. Te contactaremos pronto para coordinar el pago y la entrega en ${safeCity}.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <thead>
                  <tr>
                    <th align="left" style="padding:8px 0;border-bottom:2px solid #d4c3be;font-size:12px;text-transform:uppercase;color:#827470;">Producto</th>
                    <th style="padding:8px 8px;border-bottom:2px solid #d4c3be;font-size:12px;text-transform:uppercase;color:#827470;">Cant.</th>
                    <th align="right" style="padding:8px 0;border-bottom:2px solid #d4c3be;font-size:12px;text-transform:uppercase;color:#827470;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${renderItemsRows(content.items)}</tbody>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr><td style="padding:4px 0;color:#504441;">Subtotal</td><td align="right" style="padding:4px 0;font-weight:700;">${formatMoney(content.subtotal)}</td></tr>
                <tr><td style="padding:4px 0;color:#504441;">Envío</td><td align="right" style="padding:4px 0;font-weight:700;">${formatMoney(content.shippingCost)}</td></tr>
                <tr><td style="padding:8px 0 0;font-size:18px;font-weight:700;color:#442a22;">Total</td><td align="right" style="padding:8px 0 0;font-size:18px;font-weight:700;color:#442a22;">${formatMoney(content.total)}</td></tr>
              </table>
              ${safeNotes ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#504441;"><strong>Notas:</strong> ${safeNotes}</p>` : ""}
              <p style="margin:0;font-size:14px;line-height:1.6;color:#504441;">
                Te escribiremos por mail o Instagram para confirmar la forma de pago.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #e4e2de;background-color:#fbf9f5;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#827470;text-align:center;">
                <a href="${safeAppUrl}/tienda" style="color:#855300;text-decoration:none;font-weight:700;">lamesasocial.com.ar</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOrderConfirmationEmailText(content: OrderEmailContent): string {
  const lines = content.items.map(
    (item) => `- ${item.title} x${item.quantity}: ${formatMoney(item.lineTotal)}`,
  );

  return `¡Pedido recibido, ${firstName(content.customerName)}!

Registramos tu pedido #${content.orderId.slice(0, 8).toUpperCase()}.

Productos:
${lines.join("\n")}

Subtotal: ${formatMoney(content.subtotal)}
Envío: ${formatMoney(content.shippingCost)}
Total: ${formatMoney(content.total)}

Envío a: ${content.shippingCity}
${content.notes?.trim() ? `\nNotas: ${content.notes.trim()}\n` : ""}
Te contactaremos pronto para coordinar el pago y la entrega.

La Mesa Social
${content.appUrl}`;
}

export function buildOrderAdminEmailHtml(content: OrderEmailContent & { customerEmail: string }): string {
  const safeName = escapeHtml(content.customerName);
  const safeEmail = escapeHtml(content.customerEmail);
  const safeOrderId = escapeHtml(content.orderId);
  const safeCity = escapeHtml(content.shippingCity);
  const safeNotes = content.notes?.trim() ? escapeHtml(content.notes.trim()) : "—";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>Nuevo pedido</title></head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#fbf9f5;color:#442a22;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d4c3be;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:24px;">Nuevo pedido #${escapeHtml(content.orderId.slice(0, 8).toUpperCase())}</h1>
    <p style="margin:0 0 16px;color:#504441;">Cliente: <strong>${safeName}</strong> (${safeEmail})</p>
    <p style="margin:0 0 16px;color:#504441;">Envío: ${safeCity}</p>
    <table width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
      <thead>
        <tr>
          <th align="left" style="border-bottom:2px solid #d4c3be;padding:8px 0;">Producto</th>
          <th style="border-bottom:2px solid #d4c3be;padding:8px 8px;">Cant.</th>
          <th align="right" style="border-bottom:2px solid #d4c3be;padding:8px 0;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${renderItemsRows(content.items)}</tbody>
    </table>
    <p style="margin:8px 0;"><strong>Total:</strong> ${formatMoney(content.total)}</p>
    <p style="margin:8px 0;"><strong>Notas del cliente:</strong> ${safeNotes}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#827470;">ID completo: ${safeOrderId}</p>
  </div>
</body>
</html>`;
}

export function buildOrderAdminEmailText(content: OrderEmailContent & { customerEmail: string }): string {
  const lines = content.items.map(
    (item) => `- ${item.title} x${item.quantity}: ${formatMoney(item.lineTotal)}`,
  );

  return `Nuevo pedido #${content.orderId.slice(0, 8).toUpperCase()}

Cliente: ${content.customerName} (${content.customerEmail})
Envío: ${content.shippingCity}

${lines.join("\n")}

Total: ${formatMoney(content.total)}
Notas: ${content.notes?.trim() || "—"}

ID: ${content.orderId}`;
}

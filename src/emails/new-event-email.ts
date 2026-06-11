import { escapeHtml, firstName } from "./email-utils";

export type NewEventEmailContent = {
  name: string;
  eventTitle: string;
  eventLocation: string;
  eventStartsAt: string;
  eventUrl: string;
  logoUrl: string;
};

export function buildNewEventEmailHtml(content: NewEventEmailContent): string {
  const safeName = escapeHtml(firstName(content.name));
  const safeTitle = escapeHtml(content.eventTitle);
  const safeLocation = escapeHtml(content.eventLocation);
  const safeDate = escapeHtml(content.eventStartsAt);
  const safeUrl = escapeHtml(content.eventUrl);
  const safeLogoUrl = escapeHtml(content.logoUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo evento — La Mesa Social</title>
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
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.2;color:#442a22;">Hay un evento nuevo, ${safeName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#504441;">
                Publicamos un nuevo encuentro en Mar del Plata:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;width:100%;">
                <tr>
                  <td style="padding:16px;background-color:#fbf9f5;border-radius:12px;border:1px solid #e4e2de;">
                    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#442a22;">${safeTitle}</p>
                    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#504441;">📍 ${safeLocation}</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#504441;">🗓 ${safeDate}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="border-radius:12px;background-color:#855300;">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Ver evento y reservar
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e4e2de;background-color:#fbf9f5;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#827470;text-align:center;">
                Recibís este mail porque activaste alertas de eventos en tu perfil.
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

export function buildNewEventEmailText(content: NewEventEmailContent): string {
  return `Hola ${firstName(content.name)},

Hay un evento nuevo en La Mesa Social:

${content.eventTitle}
${content.eventLocation}
${content.eventStartsAt}

Ver evento: ${content.eventUrl}

Recibís este mail porque activaste alertas de eventos en tu perfil.`;
}

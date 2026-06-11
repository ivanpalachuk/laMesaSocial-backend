import { escapeHtml, firstName } from "./email-utils";

export type WelcomeEmailContent = {
  name: string;
  appUrl: string;
  logoUrl: string;
};

export function buildWelcomeEmailHtml({ name, appUrl, logoUrl }: WelcomeEmailContent): string {
  const safeName = escapeHtml(firstName(name));
  const safeAppUrl = escapeHtml(appUrl);
  const safeLogoUrl = escapeHtml(logoUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido/a a La Mesa Social</title>
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
              <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#442a22;">¡Bienvenido/a, ${safeName}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#504441;">
                Gracias por unirte a la comunidad de juegos de mesa más grande de Mar del Plata.
                Ya podés descubrir eventos, explorar la tienda y armar tu ludoteca.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr>
                  <td style="padding:12px 16px;background-color:#fbf9f5;border-radius:12px;border:1px solid #e4e2de;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#855300;">¿Qué podés hacer ahora?</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#504441;">
                      Reservá encuentros, encontrá juegos exclusivos y conectá con otros jugadores en cada partida.
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="border-radius:12px;background-color:#855300;">
                    <a href="${safeAppUrl}/landing#eventos" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Ver próximos eventos
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #e4e2de;background-color:#fbf9f5;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#827470;text-align:center;">
                Si no creaste esta cuenta, podés ignorar este correo.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#827470;text-align:center;">
                <a href="${safeAppUrl}" style="color:#855300;text-decoration:none;font-weight:700;">lamesasocial.com.ar</a>
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

export function buildWelcomeEmailText({ name, appUrl }: WelcomeEmailContent): string {
  const greetingName = firstName(name);

  return `¡Bienvenido/a a La Mesa Social, ${greetingName}!

Gracias por unirte a nuestra comunidad de juegos de mesa en Mar del Plata.

Ya podés descubrir eventos, explorar la tienda y armar tu ludoteca.

Ver próximos eventos: ${appUrl}/landing#eventos

Si no creaste esta cuenta, podés ignorar este correo.

La Mesa Social
${appUrl}`;
}

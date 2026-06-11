import { escapeHtml, firstName } from "./email-utils";

export type PasswordResetEmailContent = {
  name: string;
  resetUrl: string;
  logoUrl: string;
};

export function buildPasswordResetEmailHtml({ name, resetUrl, logoUrl }: PasswordResetEmailContent): string {
  const safeName = escapeHtml(firstName(name));
  const safeResetUrl = escapeHtml(resetUrl);
  const safeLogoUrl = escapeHtml(logoUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecer contraseña — La Mesa Social</title>
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
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.2;color:#442a22;">Hola, ${safeName}</h1>
              <p style="margin:10px 0 0;font-size:16px;line-height:1.5;color:#504441;">Restablecé tu contraseña</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#504441;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              </p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#504441;">
                El enlace expira en 1 hora. Si no solicitaste este cambio, podés ignorar este correo.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="border-radius:12px;background-color:#855300;">
                    <a href="${safeResetUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Crear nueva contraseña
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #e4e2de;background-color:#fbf9f5;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#827470;text-align:center;">
                Si el botón no funciona, copiá este enlace en tu navegador:<br />
                <a href="${safeResetUrl}" style="color:#855300;word-break:break-all;">${safeResetUrl}</a>
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

export function buildPasswordResetEmailText({ name, resetUrl }: PasswordResetEmailContent): string {
  const greetingName = firstName(name);

  return `Hola, ${greetingName}

Recibimos una solicitud para restablecer la contraseña de tu cuenta en La Mesa Social.

Creá una nueva contraseña aquí (expira en 1 hora):
${resetUrl}

Si no solicitaste este cambio, podés ignorar este correo.

La Mesa Social`;
}

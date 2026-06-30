type MercadoPagoPreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "ARS";
};

export type MercadoPagoPreferenceInput = {
  accessToken: string;
  appUrl: string;
  notificationUrl: string;
  pedidoId: string;
  payer: {
    name: string;
    email: string;
  };
  items: MercadoPagoPreferenceItem[];
};

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
};

function assertMercadoPagoAccessToken(accessToken: string | undefined): string {
  const token = accessToken?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
  }
  return token;
}

async function parseMercadoPagoError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Mercado Pago error ${response.status}`;
  } catch {
    return `Mercado Pago error ${response.status}`;
  }
}

export async function createMercadoPagoPreference(
  input: MercadoPagoPreferenceInput,
): Promise<MercadoPagoPreferenceResponse> {
  const accessToken = assertMercadoPagoAccessToken(input.accessToken);
  const appUrl = input.appUrl.replace(/\/$/, "");

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: input.items,
      payer: input.payer,
      external_reference: input.pedidoId,
      metadata: {
        pedido_id: input.pedidoId,
      },
      back_urls: {
        success: `${appUrl}/pago/success?pedido=${input.pedidoId}`,
        failure: `${appUrl}/pago/failure?pedido=${input.pedidoId}`,
        pending: `${appUrl}/pago/pending?pedido=${input.pedidoId}`,
      },
      auto_return: "approved",
      notification_url: input.notificationUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseMercadoPagoError(response));
  }

  return response.json();
}

export async function fetchMercadoPagoPayment(
  accessToken: string | undefined,
  paymentId: string,
): Promise<MercadoPagoPaymentResponse> {
  const token = assertMercadoPagoAccessToken(accessToken);
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseMercadoPagoError(response));
  }

  return response.json();
}

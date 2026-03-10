// lib/whatsapp.ts

export type WhatsAppParsedInbound = {
  wamid: string;
  from: string;
  text: string;
  phoneNumberId: string | null;
};

export function extractInboundWhatsAppMessage(payload: any): WhatsAppParsedInbound | null {
  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    const type = message?.type;
    if (type !== "text") {
      return {
        wamid: message?.id ?? "",
        from: message?.from ?? "",
        text: "",
        phoneNumberId: value?.metadata?.phone_number_id ?? null,
      };
    }

    return {
      wamid: message?.id ?? "",
      from: message?.from ?? "",
      text: message?.text?.body ?? "",
      phoneNumberId: value?.metadata?.phone_number_id ?? null,
    };
  } catch {
    return null;
  }
}

export async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("Variáveis META_WHATSAPP_* não configuradas.");
  }

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          body,
        },
      }),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ao enviar WhatsApp: ${JSON.stringify(json)}`);
  }

  return json;
}

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function findBestNameMatch<T extends { nome: string }>(
  items: T[],
  hint?: string | null
): T | null {
  if (!hint?.trim()) return null;

  const needle = normalizeText(hint);

  const exact = items.find((item) => normalizeText(item.nome) === needle);
  if (exact) return exact;

  const contains = items.find((item) => normalizeText(item.nome).includes(needle));
  if (contains) return contains;

  const reverseContains = items.find((item) => needle.includes(normalizeText(item.nome)));
  if (reverseContains) return reverseContains;

  return null;
}
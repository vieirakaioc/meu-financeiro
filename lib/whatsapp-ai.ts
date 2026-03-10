// lib/whatsapp-ai.ts

export type ParsedWhatsAppFinanceIntent = {
  intent: "register_transaction" | "help" | "ignore";
  tipo: "receita" | "despesa" | null;
  valor: number | null;
  descricao: string | null;
  data: string | null;
  category_hint: string | null;
  account_hint: string | null;
  confidence: number | null;
};

const hojeLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};

export async function parseWhatsAppFinanceMessage(message: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const body = {
    model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `
Você é um extrator de lançamentos financeiros via WhatsApp.
Sua missão é transformar a mensagem do usuário em JSON.

Regras:
- Se a pessoa informou gasto, classifique como "despesa".
- Se informou recebimento, classifique como "receita".
- Se não der para entender, use intent = "help".
- data padrão = hoje (${hojeLocal()}) se o usuário não informar outra.
- "ontem" = dia anterior.
- Se a pessoa disser algo como "gastei 45 no uber", então:
  tipo = despesa
  valor = 45
  descricao = "Uber"
  category_hint = "Transporte"
- Se disser "recebi 3500 salário":
  tipo = receita
  valor = 3500
  descricao = "Salário"
  category_hint = "Salário"
- Não invente valor.
- confidence vai de 0 a 1.
        `.trim(),
      },
      {
        role: "user",
        content: message,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "whatsapp_finance_parser",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            intent: {
              type: "string",
              enum: ["register_transaction", "help", "ignore"],
            },
            tipo: {
              type: ["string", "null"],
              enum: ["receita", "despesa", null],
            },
            valor: {
              type: ["number", "null"],
            },
            descricao: {
              type: ["string", "null"],
            },
            data: {
              type: ["string", "null"],
            },
            category_hint: {
              type: ["string", "null"],
            },
            account_hint: {
              type: ["string", "null"],
            },
            confidence: {
              type: ["number", "null"],
            },
          },
          required: [
            "intent",
            "tipo",
            "valor",
            "descricao",
            "data",
            "category_hint",
            "account_hint",
            "confidence",
          ],
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Erro OpenAI: ${JSON.stringify(json)}`);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI não retornou conteúdo.");
  }

  return JSON.parse(content) as ParsedWhatsAppFinanceIntent;
}
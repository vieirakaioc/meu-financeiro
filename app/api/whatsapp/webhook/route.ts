// app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { parseWhatsAppFinanceMessage } from "../../../../lib/whatsapp-ai";
import {
  extractInboundWhatsAppMessage,
  findBestNameMatch,
  sendWhatsAppText,
} from "../../../../lib/whatsapp";

export const runtime = "nodejs";

type BindingRow = {
  id: string;
  user_id: string;
  phone_e164: string;
  default_account_id: string | null;
  default_receita_category_id: string | null;
  default_despesa_category_id: string | null;
  active: boolean;
};

type AccountRow = {
  id: string;
  nome: string;
  saldo_inicial: number | string | null;
  saldo_atual: number | string | null;
};

type CategoryRow = {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
};

async function recalculateAccountBalance(accountId: string, userId: string) {
  const [{ data: conta, error: contaError }, { data: transacoes, error: transError }] =
    await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("id, saldo_inicial")
        .eq("id", accountId)
        .eq("user_id", userId)
        .single(),
      supabaseAdmin
        .from("transactions")
        .select("tipo, valor")
        .eq("user_id", userId)
        .eq("account_id", accountId),
    ]);

  if (contaError) throw new Error(`Erro buscando conta: ${contaError.message}`);
  if (transError) throw new Error(`Erro buscando transações da conta: ${transError.message}`);

  const saldoInicial = Number(conta?.saldo_inicial ?? 0);

  const saldoCalculado =
    saldoInicial +
    (transacoes ?? []).reduce((acc, item) => {
      const valor = Number(item.valor ?? 0);
      return item.tipo === "receita" ? acc + valor : acc - valor;
    }, 0);

  const { error: updateError } = await supabaseAdmin
    .from("accounts")
    .update({ saldo_atual: saldoCalculado })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`Erro atualizando saldo da conta: ${updateError.message}`);
  }
}

async function saveEventLogOnce(wamid: string, phoneFrom: string, messageText: string, payload: any) {
  const { error } = await supabaseAdmin.from("whatsapp_event_logs").insert([
    {
      wamid,
      phone_from: phoneFrom,
      message_text: messageText,
      payload,
      status: "received",
    },
  ]);

  if (error) {
    if ((error as any).code === "23505") {
      return false;
    }
    throw new Error(`Erro ao gravar log WhatsApp: ${error.message}`);
  }

  return true;
}

async function updateEventStatus(wamid: string, status: string, transactionId?: string | null) {
  await supabaseAdmin
    .from("whatsapp_event_logs")
    .update({
      status,
      transaction_id: transactionId ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("wamid", wamid);
}

export async function GET(req: NextRequest) {
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const inbound = extractInboundWhatsAppMessage(payload);

    if (!inbound || !inbound.wamid || !inbound.from) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const firstSave = await saveEventLogOnce(
      inbound.wamid,
      inbound.from,
      inbound.text ?? "",
      payload
    );

    if (!firstSave) {
      return NextResponse.json({ ok: true, deduplicated: true }, { status: 200 });
    }

    if (!inbound.text?.trim()) {
      await sendWhatsAppText(
        inbound.from,
        "Por enquanto eu só entendo mensagens de texto. Ex: gastei 45 no uber."
      );
      await updateEventStatus(inbound.wamid, "ignored_non_text");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { data: binding, error: bindingError } = await supabaseAdmin
      .from("whatsapp_user_bindings")
      .select("*")
      .eq("phone_e164", inbound.from)
      .eq("active", true)
      .single();

    if (bindingError || !binding) {
      await sendWhatsAppText(
        inbound.from,
        "Seu número ainda não está vinculado ao app. Me peça depois pra te passar o comando SQL de vínculo."
      );
      await updateEventStatus(inbound.wamid, "binding_not_found");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const bindingRow = binding as BindingRow;

    const [accountsRes, categoriesRes] = await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("id, nome, saldo_inicial, saldo_atual")
        .eq("user_id", bindingRow.user_id)
        .order("nome", { ascending: true }),
      supabaseAdmin
        .from("categories")
        .select("id, nome, tipo")
        .eq("user_id", bindingRow.user_id)
        .order("nome", { ascending: true }),
    ]);

    if (accountsRes.error) throw new Error(accountsRes.error.message);
    if (categoriesRes.error) throw new Error(categoriesRes.error.message);

    const accounts = (accountsRes.data ?? []) as AccountRow[];
    const categories = (categoriesRes.data ?? []) as CategoryRow[];

    if (!accounts.length) {
      await sendWhatsAppText(
        inbound.from,
        "Você não tem nenhuma conta cadastrada no app ainda."
      );
      await updateEventStatus(inbound.wamid, "no_accounts");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const parsed = await parseWhatsAppFinanceMessage(inbound.text);

    if (parsed.intent !== "register_transaction") {
      await sendWhatsAppText(
        inbound.from,
        "Manda assim que eu lanço automático:\n\n• gastei 45 no uber\n• recebi 3500 salário\n• gastei 120 no ifood ontem"
      );
      await updateEventStatus(inbound.wamid, "help_returned");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!parsed.tipo || !parsed.valor || !parsed.descricao) {
      await sendWhatsAppText(
        inbound.from,
        "Não consegui entender direito. Me manda em um formato mais direto, tipo: gastei 45 no uber."
      );
      await updateEventStatus(inbound.wamid, "parse_incomplete");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const matchedAccount =
      findBestNameMatch(accounts, parsed.account_hint) ||
      accounts.find((a) => a.id === bindingRow.default_account_id) ||
      accounts[0];

    const categoriesByType = categories.filter((c) => c.tipo === parsed.tipo);

    const matchedCategoryByHint =
      findBestNameMatch(categoriesByType, parsed.category_hint) ||
      findBestNameMatch(categoriesByType, parsed.descricao);

    const fallbackCategory =
      parsed.tipo === "receita"
        ? categoriesByType.find((c) => c.id === bindingRow.default_receita_category_id)
        : categoriesByType.find((c) => c.id === bindingRow.default_despesa_category_id);

    const finalCategory = matchedCategoryByHint || fallbackCategory || categoriesByType[0];

    if (!finalCategory) {
      await sendWhatsAppText(
        inbound.from,
        `Você ainda não tem categoria de ${parsed.tipo} cadastrada no app.`
      );
      await updateEventStatus(inbound.wamid, "no_category");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const dataLancamento =
      parsed.data && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data)
        ? parsed.data
        : new Date().toISOString().split("T")[0];

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([
        {
          user_id: bindingRow.user_id,
          account_id: matchedAccount.id,
          category_id: finalCategory.id,
          tipo: parsed.tipo,
          descricao: parsed.descricao,
          valor: Number(parsed.valor),
          data_lancamento: dataLancamento,
          data_competencia: dataLancamento,
          status: "pago",
        },
      ])
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Erro ao gravar transação: ${insertError.message}`);
    }

    await recalculateAccountBalance(matchedAccount.id, bindingRow.user_id);
    await updateEventStatus(inbound.wamid, "transaction_created", inserted.id);

    const sinal = parsed.tipo === "receita" ? "+" : "-";

    await sendWhatsAppText(
      inbound.from,
      [
        "Lançamento feito com sucesso ✅",
        "",
        `${sinal} ${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Number(parsed.valor))}`,
        `Descrição: ${parsed.descricao}`,
        `Categoria: ${finalCategory.nome}`,
        `Conta: ${matchedAccount.nome}`,
        `Data: ${dataLancamento}`,
      ].join("\n")
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("WhatsApp webhook error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Internal error",
      },
      { status: 200 }
    );
  }
}
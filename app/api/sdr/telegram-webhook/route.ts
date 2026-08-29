import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramText } from "@/lib/telegram-dm";
import { resolveQuickReply, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import { processarMensagemSDRCore, isIaAtiva, SDR_INTERNO_PARTNER_ID } from "@/lib/sdr-agent";

// Webhook da Telegram Bot API — mesmo método dos outros 3 canais (webhook →
// processarMensagemSDRCore), adaptado ao formato de update da Telegram, que
// é bem mais simples que o da Meta: sem handshake de verificação por query
// string, sem "is_echo" (o bot nunca recebe eco da própria mensagem) e sem
// janela de 24h. A autenticidade da chamada é garantida pelo header secreto
// (ver setTelegramWebhook em lib/telegram-dm.ts), não por um token na URL.
// "phone" (nome histórico da coluna, ver sdr-agent.ts) guarda o chat_id do
// Telegram nesse canal.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CANAL = "telegram" as const;

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string };
    from?: { id: number; is_bot?: boolean; first_name?: string; username?: string };
    text?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    // Garante que só a Telegram (com o secret configurado via setWebhook)
    // consegue postar aqui — sem isso qualquer um poderia forjar mensagens
    // pro Agente SDR processar.
    const secretRecebido = req.headers.get("x-telegram-bot-api-secret-token");
    const secretEsperado = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secretEsperado || secretRecebido !== secretEsperado) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const update = await req.json() as TelegramUpdate;
    const message = update.message;

    // Grupos/canais e mensagens de outros bots ficam fora do escopo do SDR
    // (que atende leads em conversa privada 1:1).
    if (!message || message.chat.type !== "private" || message.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    await processarMensagem(update.update_id, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[SDR Telegram Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function processarMensagem(updateId: number, message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = String(message.chat.id);
  const rawMessageText = message.text;

  if (!rawMessageText) {
    console.log(`[SDR Telegram Webhook] Mensagem sem texto de ${chatId} (anexo/comando?) — ignorando`);
    return;
  }

  console.log(`[SDR Telegram Webhook] Mensagem de ${chatId}: ${rawMessageText.substring(0, 80)}`);

  const instance = "telegram";

  // Resolve resposta a opções de quick reply simuladas por texto — mesmo
  // método do WhatsApp (ver lib/whatsapp/quick-reply.ts).
  let messageText = rawMessageText;
  const { data: ultimaConversa } = await supabase
    .from("sdr_conversas")
    .select("role, quick_reply_options")
    .eq("phone", chatId)
    .eq("canal", CANAL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimaConversa?.role === "assistant" && Array.isArray(ultimaConversa.quick_reply_options)) {
    const resolvida = resolveQuickReply(rawMessageText, ultimaConversa.quick_reply_options as QuickReplyOption[]);
    if (resolvida) messageText = resolvida.label;
  }

  // Idempotência: reaproveita a coluna wa_message_id (nome histórico) com o
  // update_id da Telegram — estável entre reentregas do mesmo update.
  const { error: insertErr } = await supabase.from("sdr_conversas").insert({
    phone: chatId,
    canal: CANAL,
    role: "user",
    content: messageText,
    instance,
    wa_message_id: String(updateId),
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[SDR Telegram Webhook] Update ${updateId} de ${chatId} já processado — ignorando reentrega`);
      return;
    }
    console.error("[SDR Telegram Webhook] Erro ao salvar mensagem:", insertErr);
  }

  // Nome não entra no upsert de todo turno (mesmo padrão do WhatsApp/Instagram/
  // Messenger) — evita sobrescrever um nome editado manualmente no CRM a cada
  // nova mensagem. Só preenche no primeiro contato, quando o lead ainda não existe.
  const { data: leadExistente } = await supabase
    .from("sdr_leads")
    .select("phone")
    .eq("phone", chatId)
    .eq("partner_id", SDR_INTERNO_PARTNER_ID)
    .maybeSingle();

  const nomeTelegram = [message.from?.first_name, message.from?.username ? `@${message.from.username}` : null]
    .filter(Boolean).join(" ") || null;

  await supabase.from("sdr_leads").upsert({
    phone: chatId,
    partner_id: SDR_INTERNO_PARTNER_ID,
    canal: CANAL,
    ...(leadExistente ? {} : { nome: nomeTelegram }),
    last_message_at: new Date().toISOString(),
    last_message_preview: messageText.slice(0, 80),
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone,partner_id", ignoreDuplicates: false });

  const { data: leadData } = await supabase
    .from("sdr_leads")
    .select("humano_ativo")
    .eq("phone", chatId)
    .eq("partner_id", SDR_INTERNO_PARTNER_ID)
    .single();

  if (leadData?.humano_ativo) {
    console.log(`[SDR Telegram Webhook] Atendimento humano ativo para ${chatId} — IA pausada`);
    return;
  }

  if (!(await isIaAtiva(CANAL))) {
    console.log(`[SDR Telegram Webhook] IA automática desligada globalmente — mensagem de ${chatId} só salva`);
    return;
  }

  after(() => processarMensagemSDRCore({
    phone: chatId,
    mensagem: messageText,
    instance,
    canal: CANAL,
    enviarTexto: (texto) => sendTelegramText(chatId, texto),
  }).catch(e =>
    console.error("[SDR Telegram Webhook] Erro ao processar mensagem (background):", e)
  ));
}

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramText } from "@/lib/telegram-dm";
import { decryptSecret } from "@/lib/crypto/secret";
import { resolveQuickReply, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import { processarMensagemSDRCore, isIaAtiva } from "@/lib/sdr-agent";

// Webhook do bot Telegram de um partner white label — irmão de
// app/api/sdr/telegram-webhook/route.ts (bot interno da V3), só que o bot e
// o segredo são por partner (o :partnerId na URL é como identificamos QUAL
// conexão validar, já que a Telegram não manda o token de volta no payload).

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;

    const { data: conexao } = await supabase
      .from("partner_sdr_connections")
      .select("telegram_status, telegram_webhook_secret, telegram_bot_token_encrypted")
      .eq("partner_id", partnerId)
      .maybeSingle();

    if (!conexao || conexao.telegram_status !== "conectado" || !conexao.telegram_webhook_secret || !conexao.telegram_bot_token_encrypted) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const secretRecebido = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretRecebido !== conexao.telegram_webhook_secret) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const botToken = decryptSecret(conexao.telegram_bot_token_encrypted);

    const update = await req.json() as TelegramUpdate;
    const message = update.message;

    if (!message || message.chat.type !== "private" || message.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    await processarMensagem(partnerId, botToken, update.update_id, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Partner Telegram Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function processarMensagem(
  partnerId: string,
  botToken: string,
  updateId: number,
  message: NonNullable<TelegramUpdate["message"]>
) {
  const chatId = String(message.chat.id);
  const rawMessageText = message.text;

  if (!rawMessageText) {
    console.log(`[Partner Telegram Webhook] Mensagem sem texto de ${chatId} (partner ${partnerId}) — ignorando`);
    return;
  }

  const instance = "telegram";

  let messageText = rawMessageText;
  const { data: ultimaConversa } = await supabase
    .from("sdr_conversas")
    .select("role, quick_reply_options")
    .eq("phone", chatId)
    .eq("canal", CANAL)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimaConversa?.role === "assistant" && Array.isArray(ultimaConversa.quick_reply_options)) {
    const resolvida = resolveQuickReply(rawMessageText, ultimaConversa.quick_reply_options as QuickReplyOption[]);
    if (resolvida) messageText = resolvida.label;
  }

  const { data: conversaInserida, error: insertErr } = await supabase.from("sdr_conversas").insert({
    phone: chatId,
    canal: CANAL,
    role: "user",
    content: messageText,
    instance,
    wa_message_id: String(updateId),
    partner_id: partnerId,
  }).select("created_at").single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[Partner Telegram Webhook] Update ${updateId} de ${chatId} (partner ${partnerId}) já processado — ignorando reentrega`);
      return;
    }
    console.error("[Partner Telegram Webhook] Erro ao salvar mensagem:", insertErr);
  }

  const { data: leadExistente } = await supabase
    .from("sdr_leads")
    .select("phone")
    .eq("phone", chatId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  const nomeTelegram = [message.from?.first_name, message.from?.username ? `@${message.from.username}` : null]
    .filter(Boolean).join(" ") || null;

  await supabase.from("sdr_leads").upsert({
    phone: chatId,
    partner_id: partnerId,
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
    .eq("partner_id", partnerId)
    .single();

  if (leadData?.humano_ativo) {
    console.log(`[Partner Telegram Webhook] Atendimento humano ativo para ${chatId} (partner ${partnerId}) — IA pausada`);
    return;
  }

  if (!(await isIaAtiva(CANAL, partnerId))) {
    console.log(`[Partner Telegram Webhook] IA desligada pro partner ${partnerId} — mensagem de ${chatId} só salva`);
    return;
  }

  after(() => processarMensagemSDRCore({
    phone: chatId,
    mensagem: messageText,
    instance,
    canal: CANAL,
    partnerId,
    mensagemCreatedAt: conversaInserida?.created_at ?? null,
    enviarTexto: (texto) => sendTelegramText(chatId, texto, botToken),
  }).catch(e =>
    console.error("[Partner Telegram Webhook] Erro ao processar mensagem (background):", e)
  ));
}

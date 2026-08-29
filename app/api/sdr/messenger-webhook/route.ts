import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessengerText } from "@/lib/messenger-dm";
import { decryptPageToken } from "@/lib/meta-oauth";
import { resolveQuickReply, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import { processarMensagemSDRCore, isIaAtiva, SDR_INTERNO_PARTNER_ID } from "@/lib/sdr-agent";

// Webhook do Facebook Messenger (Messenger Platform) — irmão direto de
// app/api/sdr/instagram-webhook/route.ts, mesmo formato de payload da Meta
// (Send/Receive API), "object" diferente ("page" em vez de "instagram").
// "phone" (nome histórico da coluna, ver sdr-agent.ts) guarda o PSID
// (Page-Scoped ID) do remetente nesse canal. Atende tanto o bot interno da
// V3 (token fixo no env) quanto os partners white label conectados via
// OAuth (ver lib/meta-oauth.ts) — resolveContextoMessenger decide qual.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CANAL = "messenger" as const;

// ── Handshake de verificação do webhook (Meta chama isso uma vez ao ativar
// a inscrição em developers.facebook.com/apps/.../webhooks) ────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Payload do Messenger Platform webhook:
// { object: "page", entry: [{ id, time, messaging: [{ sender, recipient, timestamp, message }] }] }
type MessengerEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
};

type MessengerWebhookPayload = {
  object?: string;
  entry?: { id?: string; time?: number; messaging?: MessengerEvent[] }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MessengerWebhookPayload;
    if (body.object !== "page") return NextResponse.json({ ok: true });

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        await processarEvento(event, entry.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[SDR Messenger Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Resolve de qual partner é essa Página (entry.id = meta_page_id) — mesmo
// princípio do whitelabel do WhatsApp (ver session_id do OpenWA em
// app/api/sdr/webhook/route.ts). Página não encontrada = bot interno da V3.
async function resolveContextoMessenger(pageId?: string): Promise<{
  partnerId: string | null;
  enviarTexto: (psid: string, texto: string) => Promise<void>;
}> {
  if (pageId) {
    const { data: conexao } = await supabase
      .from("partner_sdr_connections")
      .select("partner_id, meta_page_access_token_encrypted, messenger_status")
      .eq("meta_page_id", pageId)
      .eq("messenger_status", "conectado")
      .maybeSingle();

    if (conexao?.meta_page_access_token_encrypted) {
      const pageToken = decryptPageToken(conexao.meta_page_access_token_encrypted);
      return { partnerId: conexao.partner_id, enviarTexto: (psid, texto) => sendMessengerText(psid, texto, pageToken) };
    }
  }
  return { partnerId: null, enviarTexto: (psid, texto) => sendMessengerText(psid, texto) };
}

async function processarEvento(event: MessengerEvent, entryId?: string) {
  const psid = event.sender?.id;
  const message = event.message;

  // is_echo: eco da própria mensagem que o SDR acabou de enviar via Send API
  // — a Meta reenvia ela pro webhook também; ignorar, senão o bot responde a
  // si mesmo (mesma regra do webhook do Instagram).
  if (!psid || !message || message.is_echo) return;

  const rawMessageText = message.text;
  if (!rawMessageText) {
    console.log(`[SDR Messenger Webhook] Mensagem sem texto de ${psid} (anexo?) — ignorando`);
    return;
  }

  console.log(`[SDR Messenger Webhook] Mensagem de ${psid}: ${rawMessageText.substring(0, 80)}`);

  const instance = "messenger";
  const { partnerId, enviarTexto } = await resolveContextoMessenger(entryId);
  const partnerIdColuna = partnerId ?? SDR_INTERNO_PARTNER_ID;

  // Resolve resposta a opções de quick reply simuladas por texto — mesmo
  // método do WhatsApp (ver lib/whatsapp/quick-reply.ts e comentário
  // equivalente em app/api/sdr/webhook/route.ts).
  let messageText = rawMessageText;
  let ultimaConversaQuery = supabase
    .from("sdr_conversas")
    .select("role, quick_reply_options")
    .eq("phone", psid)
    .eq("canal", CANAL);
  ultimaConversaQuery = partnerId ? ultimaConversaQuery.eq("partner_id", partnerId) : ultimaConversaQuery.is("partner_id", null);
  const { data: ultimaConversa } = await ultimaConversaQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimaConversa?.role === "assistant" && Array.isArray(ultimaConversa.quick_reply_options)) {
    const resolvida = resolveQuickReply(rawMessageText, ultimaConversa.quick_reply_options as QuickReplyOption[]);
    if (resolvida) messageText = resolvida.label;
  }

  // Idempotência: reaproveita a coluna wa_message_id (nome histórico — guarda
  // o id externo da mensagem no canal de origem, aqui o "mid" do Messenger).
  const { error: insertErr } = await supabase.from("sdr_conversas").insert({
    phone: psid,
    canal: CANAL,
    role: "user",
    content: messageText,
    instance,
    wa_message_id: message.mid ?? null,
    partner_id: partnerId,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[SDR Messenger Webhook] Mensagem ${message.mid} de ${psid} já processada — ignorando reentrega`);
      return;
    }
    console.error("[SDR Messenger Webhook] Erro ao salvar mensagem:", insertErr);
  }

  await supabase.from("sdr_leads").upsert({
    phone: psid,
    partner_id: partnerIdColuna,
    canal: CANAL,
    last_message_at: new Date().toISOString(),
    last_message_preview: messageText.slice(0, 80),
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone,partner_id", ignoreDuplicates: false });

  const { data: leadData } = await supabase
    .from("sdr_leads")
    .select("humano_ativo")
    .eq("phone", psid)
    .eq("partner_id", partnerIdColuna)
    .single();

  if (leadData?.humano_ativo) {
    console.log(`[SDR Messenger Webhook] Atendimento humano ativo para ${psid} — IA pausada`);
    return;
  }

  if (!(await isIaAtiva(CANAL, partnerId))) {
    console.log(`[SDR Messenger Webhook] IA automática desligada (partner ${partnerId ?? "interno"}) — mensagem de ${psid} só salva`);
    return;
  }

  after(() => processarMensagemSDRCore({
    phone: psid,
    mensagem: messageText,
    instance,
    canal: CANAL,
    partnerId,
    enviarTexto: (texto) => enviarTexto(psid, texto),
  }).catch(e =>
    console.error("[SDR Messenger Webhook] Erro ao processar mensagem (background):", e)
  ));
}

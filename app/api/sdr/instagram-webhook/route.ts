import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendInstagramText, sendInstagramPrivateReply, replyToInstagramComment } from "@/lib/instagram-dm";
import { processarMensagemSDRCore, isIaAtiva } from "@/lib/sdr-agent";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CANAL = "instagram" as const;

// ── Handshake de verificação do webhook (Meta chama isso uma vez ao ativar
// a inscrição em developers.facebook.com/apps/.../webhooks) ────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Payload do Instagram Messaging webhook (Messenger Platform):
// { object: "instagram", entry: [{ id, time, messaging: [{ sender, recipient, timestamp, message }] }] }
type InstagramMessagingEvent = {
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

// Payload de comentários (campo "comments" do webhook — Comment-to-DM):
// { object: "instagram", entry: [{ id, time, changes: [{ field: "comments", value: {...} }] }] }
type InstagramCommentChange = {
  field?: string;
  value?: {
    id?: string;
    text?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string; media_product_type?: string };
  };
};

type InstagramWebhookPayload = {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    messaging?: InstagramMessagingEvent[];
    changes?: InstagramCommentChange[];
  }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as InstagramWebhookPayload;
    if (body.object !== "instagram") return NextResponse.json({ ok: true });

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        await processarEvento(event);
      }
      for (const change of entry.changes ?? []) {
        if (change.field === "comments") {
          await processarComentario(change.value, entry.id);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[SDR Instagram Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function processarEvento(event: InstagramMessagingEvent) {
  const igsid = event.sender?.id;
  const message = event.message;

  // is_echo: eco da própria mensagem que o SDR acabou de enviar via Send API —
  // a Meta reenvia ela pro webhook também; ignorar, senão o bot responde a si mesmo.
  if (!igsid || !message || message.is_echo) return;

  const messageText = message.text;
  if (!messageText) {
    // Anexo (imagem, áudio, story reply etc.) sem texto — fora de escopo por ora.
    console.log(`[SDR Instagram Webhook] Mensagem sem texto de ${igsid} (anexo?) — ignorando`);
    return;
  }

  console.log(`[SDR Instagram Webhook] Mensagem de ${igsid}: ${messageText.substring(0, 80)}`);

  const instance = "instagram";

  // Idempotência: reaproveita a coluna wa_message_id (e seu índice único em
  // (phone, wa_message_id)) — apesar do nome, ela só guarda "id externo da
  // mensagem no canal de origem", igual phone guarda o IGSID aqui em vez de
  // um número de telefone. Ver comentário na migration 20260819_sdr_canal_instagram.sql.
  const { error: insertErr } = await supabase.from("sdr_conversas").insert({
    phone: igsid,
    canal: CANAL,
    role: "user",
    content: messageText,
    instance,
    wa_message_id: message.mid ?? null,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[SDR Instagram Webhook] Mensagem ${message.mid} de ${igsid} já processada — ignorando reentrega`);
      return;
    }
    console.error("[SDR Instagram Webhook] Erro ao salvar mensagem:", insertErr);
  }

  await supabase.from("sdr_leads").upsert({
    phone: igsid,
    canal: CANAL,
    last_message_at: new Date().toISOString(),
    last_message_preview: messageText.slice(0, 80),
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone", ignoreDuplicates: false });

  const { data: leadData } = await supabase
    .from("sdr_leads")
    .select("humano_ativo")
    .eq("phone", igsid)
    .single();

  if (leadData?.humano_ativo) {
    console.log(`[SDR Instagram Webhook] Atendimento humano ativo para ${igsid} — IA pausada`);
    return;
  }

  if (!(await isIaAtiva(CANAL))) {
    console.log(`[SDR Instagram Webhook] IA automática desligada globalmente — mensagem de ${igsid} só salva`);
    return;
  }

  after(() => processarMensagemSDRCore({
    phone: igsid,
    mensagem: messageText,
    instance,
    canal: CANAL,
    enviarTexto: (texto) => sendInstagramText(igsid, texto),
  }).catch(e =>
    console.error("[SDR Instagram Webhook] Erro ao processar mensagem (background):", e)
  ));
}

// ── Comment-to-DM ────────────────────────────────────────────────────────
async function processarComentario(value: InstagramCommentChange["value"], ownAccountId?: string) {
  const commentId = value?.id;
  const commentText = value?.text;
  const fromId = value?.from?.id;
  const mediaId = value?.media?.id;

  if (!commentId || !commentText || !fromId) return;

  // A Meta reentrega o próprio comentário de resposta pública do bot como um
  // novo evento "comments" — sem esse corte o bot responderia a si mesmo em loop.
  if (ownAccountId && fromId === ownAccountId) return;

  const textoNormalizado = commentText.toLowerCase();

  const { data: triggers, error: triggersErr } = await supabase
    .from("sdr_comment_triggers")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  if (triggersErr) {
    console.error("[SDR Instagram Webhook] Erro ao buscar comment triggers:", triggersErr);
    return;
  }

  const trigger = (triggers ?? []).find((t) => {
    if (t.media_id && t.media_id !== mediaId) return false;
    const palavras: string[] = t.palavras_chave ?? [];
    if (palavras.length === 0) return false;
    return palavras.some((p) => textoNormalizado.includes(String(p).toLowerCase()));
  });

  if (!trigger) return;

  console.log(`[SDR Instagram Webhook] Comentário ${commentId} de ${fromId} casou com trigger "${trigger.nome}"`);

  // Idempotência: comment_id é único — reentrega da Meta não dispara DM de novo.
  const { error: insertErr } = await supabase.from("sdr_comment_events").insert({
    trigger_id: trigger.id,
    comment_id: commentId,
    media_id: mediaId ?? null,
    from_igsid: fromId,
    from_username: value?.from?.username ?? null,
    comment_text: commentText,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[SDR Instagram Webhook] Comentário ${commentId} já processado — ignorando reentrega`);
      return;
    }
    console.error("[SDR Instagram Webhook] Erro ao salvar comment event:", insertErr);
    return;
  }

  after(async () => {
    try {
      await sendInstagramPrivateReply(commentId, trigger.mensagem_dm);
      if (trigger.resposta_publica) {
        await replyToInstagramComment(commentId, trigger.resposta_publica);
      }
      await supabase.from("sdr_comment_events").update({ dm_enviada: true }).eq("comment_id", commentId);
      await supabase
        .from("sdr_comment_triggers")
        .update({ total_disparos: (trigger.total_disparos ?? 0) + 1 })
        .eq("id", trigger.id);
    } catch (e) {
      console.error("[SDR Instagram Webhook] Erro ao enviar private reply:", e);
      await supabase.from("sdr_comment_events").update({ erro: String(e) }).eq("comment_id", commentId);
    }
  });
}

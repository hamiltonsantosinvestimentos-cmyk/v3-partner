import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatIdToPhone, sendText } from "@/lib/whatsapp/openwa-client";
import { resolveQuickReply, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import { processarMensagemSDRCore, isIaAtiva } from "@/lib/sdr-agent";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CANAL = "whatsapp" as const;

// Envelope enviado pelo OpenWA: { event, timestamp, sessionId, idempotencyKey, deliveryId, data }
type OpenwaWebhookPayload = {
  event: string;
  sessionId: string;
  data: {
    id?: string;
    from?: string;
    chatId?: string;
    body?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    phone?: string | null;
    pushName?: string | null;
    status?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as OpenwaWebhookPayload;
    const { event, data } = body;
    const instance = "openwa";

    console.log(`[SDR Webhook] evento: ${event}`);

    // ── Status da sessão (QR, autenticado, desconectado) ──────────────────────
    // O frontend consulta status/QR diretamente em /api/sdr/qrcode (que fala com o
    // OpenWA em tempo real), então esses eventos aqui são só para log/observabilidade.
    if (event === "session.qr" || event === "session.authenticated" || event === "session.disconnected") {
      console.log(`[SDR Webhook] ${event}`, data);
      return NextResponse.json({ ok: true });
    }

    // ── Mensagem recebida ───────────────────────────────────────────────────
    if (event === "message.received") {
      if (!data || data.fromMe || data.isGroup) return NextResponse.json({ ok: true });

      const phone = chatIdToPhone(data.chatId ?? data.from ?? "");
      const rawMessageText = data.body ?? "";

      if (!rawMessageText || !phone) return NextResponse.json({ ok: true });

      console.log(`[SDR Webhook] Mensagem de ${phone}: ${rawMessageText.substring(0, 80)}`);

      // Botões de resposta rápida são simulados por texto (WhatsApp bloqueia botão nativo
      // fora da API oficial da Meta) — se a última mensagem do assistente ofereceu opções,
      // resolve a resposta do lead ("1", "1️⃣"...) contra elas e usa o label em vez do dígito
      // cru daqui em diante (histórico da IA, pipeline de qualificação, etc).
      let messageText = rawMessageText;
      const { data: ultimaConversa } = await supabase
        .from("sdr_conversas")
        .select("role, quick_reply_options")
        .eq("phone", phone)
        .eq("canal", CANAL)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaConversa?.role === "assistant" && Array.isArray(ultimaConversa.quick_reply_options)) {
        const resolvida = resolveQuickReply(rawMessageText, ultimaConversa.quick_reply_options as QuickReplyOption[]);
        if (resolvida) messageText = resolvida.label;
      }

      // Idempotência: o OpenWA pode reentregar o mesmo evento (rede, retry) — o id da
      // mensagem do WhatsApp é estável entre entregas, então um conflito aqui significa
      // "já processei essa exata mensagem", e paramos sem gerar uma segunda resposta.
      const waMessageId = data.id ?? null;
      const { error: insertErr } = await supabase.from("sdr_conversas").insert({
        phone,
        canal: CANAL,
        role: "user",
        content: messageText,
        instance,
        wa_message_id: waMessageId,
      });

      if (insertErr) {
        if (insertErr.code === "23505") {
          console.log(`[SDR Webhook] Mensagem ${waMessageId} de ${phone} já processada — ignorando reentrega`);
          return NextResponse.json({ ok: true });
        }
        console.error("[SDR Webhook] Erro ao salvar mensagem:", insertErr);
      }

      // Cria/atualiza registro de lead com preview da última mensagem
      await supabase.from("sdr_leads").upsert({
        phone,
        canal: CANAL,
        last_message_at: new Date().toISOString(),
        last_message_preview: messageText.slice(0, 80),
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone", ignoreDuplicates: false });

      // Verifica se atendimento humano está ativo — se sim, não responde com IA
      const { data: leadData } = await supabase
        .from("sdr_leads")
        .select("humano_ativo")
        .eq("phone", phone)
        .single();

      if (leadData?.humano_ativo) {
        console.log(`[SDR Webhook] Atendimento humano ativo para ${phone} — IA pausada`);
        return NextResponse.json({ ok: true });
      }

      // Interruptor global (aba SDR) — quando desligado, ninguém recebe resposta automática
      if (!(await isIaAtiva(CANAL))) {
        console.log(`[SDR Webhook] IA automática desligada globalmente — mensagem de ${phone} só salva`);
        return NextResponse.json({ ok: true });
      }

      // Responde ao OpenWA imediatamente (evita timeout/retry, que era a causa das
      // respostas duplicadas) — a IA gera e envia a resposta em segundo plano, mantendo
      // o delay humanizado sem bloquear o webhook.
      after(() => processarMensagemSDRCore({
        phone,
        mensagem: messageText,
        instance,
        canal: CANAL,
        enviarTexto: async (texto) => { await sendText(phone, texto); },
      }).catch(e =>
        console.error("[SDR Webhook] Erro ao processar mensagem (background):", e)
      ));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[SDR Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

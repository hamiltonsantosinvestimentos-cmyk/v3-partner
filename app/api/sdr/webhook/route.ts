import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Armazena o último QR code em memória para exibição
let lastQrCode: { base64: string; timestamp: number } | null = null;

export async function GET() {
  // Endpoint para consultar o QR code atual
  if (lastQrCode && Date.now() - lastQrCode.timestamp < 60000) {
    return NextResponse.json({ qrcode: lastQrCode.base64 });
  }
  return NextResponse.json({ qrcode: null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, instance, data } = body;

    console.log(`[SDR Webhook] evento: ${event} | instância: ${instance}`);

    // ── QR Code gerado ──────────────────────────────────────────────────────
    if (event === "qrcode.updated" && data?.qrcode?.base64) {
      lastQrCode = {
        base64: data.qrcode.base64,
        timestamp: Date.now(),
      };
      console.log("[SDR Webhook] QR code recebido e armazenado");
      return NextResponse.json({ ok: true });
    }

    // ── Status de conexão ───────────────────────────────────────────────────
    if (event === "connection.update") {
      const state = data?.state;
      console.log(`[SDR Webhook] Conexão WhatsApp: ${state}`);

      if (state === "open") {
        lastQrCode = null; // Limpa QR após conectar
        console.log("[SDR Webhook] WhatsApp CONECTADO!");
      }
      return NextResponse.json({ ok: true });
    }

    // ── Mensagem recebida ───────────────────────────────────────────────────
    if (event === "messages.upsert") {
      const msg = data;
      if (!msg || msg.key?.fromMe) return NextResponse.json({ ok: true });

      const remoteJid = msg.key?.remoteJid;
      const phone = remoteJid?.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const messageText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";

      if (!messageText || !phone) return NextResponse.json({ ok: true });

      console.log(`[SDR Webhook] Mensagem de ${phone}: ${messageText.substring(0, 80)}`);

      // Salva a mensagem no Supabase
      await supabase.from("sdr_conversas").insert({
        phone,
        role: "user",
        content: messageText,
        instance: instance || "v3-sdr-whatsapp",
      });

      // Processa com o agente SDR
      await processarMensagemSDR(phone, messageText, instance || "v3-sdr-whatsapp");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[SDR Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function processarMensagemSDR(phone: string, mensagem: string, instance: string) {
  try {
    // Busca histórico da conversa
    const { data: historico } = await supabase
      .from("sdr_conversas")
      .select("role, content")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = (historico || []).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

    // Chama Claude com o prompt SDR
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `Você é o assistente SDR da V3 Partners, uma boutique institucional de estruturação financeira.

Seu objetivo é qualificar leads e agendar apresentações da plataforma V3 Partners.

**Sobre a V3 Partners:**
- Boutique de securitização e estruturação financeira
- 4 verticais: Securitização de Crédito, Real Estate, Mineração e M&A Cross-Border
- Rede de Partners: R$197/mês (30% comissão) ou R$397/mês PRO (50% + co-branding)
- Plataforma SaaS exclusiva para partners

**Seu papel:**
1. Cumprimentar cordialmente
2. Entender o perfil do lead (área de atuação, interesse)
3. Apresentar brevemente a V3 Partners
4. Qualificar: tem interesse em ser partner ou investir?
5. Se qualificado: agendar uma apresentação via Google Meet
6. Coletar: nome, empresa e melhor horário para reunião

**Regras:**
- Seja profissional mas amigável
- Respostas curtas (máx 3-4 linhas no WhatsApp)
- Nunca invente informações sobre produtos específicos
- Se perguntar sobre taxas detalhadas, diga que será apresentado na reunião
- Ao confirmar reunião, diga que um dos sócios entrará em contato para confirmar o link`,
      messages,
    });

    const resposta = response.content[0].type === "text" ? response.content[0].text : "";

    if (!resposta) return;

    // Salva resposta do agente
    await supabase.from("sdr_conversas").insert({
      phone,
      role: "assistant",
      content: resposta,
      instance,
    });

    // Envia resposta pelo WhatsApp via Evolution API
    await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${instance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({
          number: phone,
          text: resposta,
        }),
      }
    );

    console.log(`[SDR Webhook] Resposta enviada para ${phone}`);
  } catch (e) {
    console.error("[SDR Webhook] Erro ao processar mensagem:", e);
  }
}

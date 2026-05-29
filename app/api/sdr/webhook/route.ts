import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, instance, data } = body;

    console.log(`[SDR Webhook] evento: ${event} | instância: ${instance}`);

    // ── QR Code gerado ──────────────────────────────────────────────────────
    if (event === "qrcode.updated" && data?.qrcode?.base64) {
      await supabase.from("sdr_config").upsert({
        key: "qrcode",
        value: data.qrcode.base64,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      console.log("[SDR Webhook] QR code salvo no Supabase");
      return NextResponse.json({ ok: true });
    }

    // ── Status de conexão ───────────────────────────────────────────────────
    if (event === "connection.update") {
      const state = data?.state;
      console.log(`[SDR Webhook] Conexão WhatsApp: ${state}`);
      await supabase.from("sdr_config").upsert({
        key: "connection_state",
        value: state ?? "unknown",
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      if (state === "open") {
        // Limpa QR após conectar
        await supabase.from("sdr_config").upsert({
          key: "qrcode",
          value: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
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

      await supabase.from("sdr_conversas").insert({
        phone,
        role: "user",
        content: messageText,
        instance: instance || "v3-sdr-whatsapp",
      });

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
    const { data: historico } = await supabase
      .from("sdr_conversas")
      .select("role, content")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages = (historico || []).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

    // Delay humanizado: entre 2 e 5 segundos antes de responder
    const delay = 2000 + Math.floor(Math.random() * 3000);
    await new Promise(r => setTimeout(r, delay));

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `Você é o Matheus, consultor de relacionamento da V3 Partners — uma boutique institucional de estruturação financeira e securitização.

Você representa uma empresa séria e de alto padrão. Seu tom é profissional, caloroso e consultivo. Você escreve como um humano experiente, não como um robô.

**Sobre a V3 Partners:**
- Boutique especializada em securitização de crédito, Real Estate estruturado, mineração/commodities e M&A cross-border
- Infraestrutura white label Bloxs S.A. (tokenização, KYC, liquidação OTC/cripto 24/7)
- Rede de Partners: plano Essencial R$197/mês (30% comissão) ou PRO R$397/mês (50% + co-branding)
- Plataforma SaaS exclusiva com CRM, pipeline M&A, mesa de crédito e squads de IA

**Seu papel:**
1. Cumprimentar com naturalidade, sem exageros
2. Entender o perfil e o momento do lead (área, empresa, interesse)
3. Apresentar a V3 Partners de forma contextualizada ao perfil dele
4. Qualificar: quer ser partner, captar recursos, estruturar operação ou investir?
5. Se qualificado, agendar uma apresentação com um dos sócios via Google Meet
6. Coletar: nome completo, empresa e melhor horário

**Regras de comunicação:**
- Escreva de forma natural, como numa conversa de WhatsApp profissional
- Use parágrafos curtos, sem bullet points ou markdown
- Nunca use asteriscos, emojis excessivos ou linguagem de chatbot
- Uma ou duas frases por vez quando for só cumprimento ou confirmação
- Para apresentações ou qualificação, pode ir até 4-5 linhas
- Nunca invente taxas, retornos ou produtos específicos — diga que os detalhes serão apresentados na reunião
- Se o lead confirmar reunião, diga que um dos sócios vai entrar em contato para confirmar o link do Meet
- Lembre-se do histórico da conversa para não repetir perguntas já feitas`,
      messages,
    });

    const resposta = response.content[0].type === "text" ? response.content[0].text : "";
    if (!resposta) return;

    await supabase.from("sdr_conversas").insert({
      phone,
      role: "assistant",
      content: resposta,
      instance,
    });

    await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${instance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ number: phone, text: resposta }),
      }
    );

    console.log(`[SDR Webhook] Resposta enviada para ${phone}`);
  } catch (e) {
    console.error("[SDR Webhook] Erro ao processar mensagem:", e);
  }
}

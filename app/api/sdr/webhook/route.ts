import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyAgendamentoSDR } from "@/lib/email";
import { syncSdrLeadToProspeccao } from "@/lib/sdr-prospeccao-sync";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, instance, data } = body;

    // Ignora chamadas do webhook global (duplicatas)
    if (body.local?.includes("Global")) return NextResponse.json({ ok: true });

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

      // Cria/atualiza registro de lead com preview da última mensagem
      await supabase.from("sdr_leads").upsert({
        phone,
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

      await processarMensagemSDR(phone, messageText, instance || "v3-sdr-whatsapp");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[SDR Webhook] Erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── Detecção de agendamento via Haiku ───────────────────────────────────────

type SinalFunil = "nenhum" | "qualificado" | "convertido" | "sem_interesse";

type AgendamentoDetect = {
  agendado: boolean;
  data_hora: string | null;
  nome_lead: string | null;
  sinal_funil: SinalFunil;
};

const SINAL_VAZIO: AgendamentoDetect = { agendado: false, data_hora: null, nome_lead: null, sinal_funil: "nenhum" };

async function detectarAgendamento(
  userMsg: string,
  botMsg: string
): Promise<AgendamentoDetect> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Analise esta troca de mensagens de WhatsApp entre um lead e um agente de vendas (SDR) e classifique o momento do funil.

Um agendamento é confirmado quando o usuário aceita ou sugere data/hora E o agente confirma.

sinal_funil (escolha o que MAIS se aplica, seja conservador — só marque se houver confirmação clara e explícita, não apenas educação/interesse superficial):
- "qualificado": o lead demonstrou claramente que o perfil se encaixa (quer ser partner, tem carteira de clientes, quer estruturar operação) — mais que curiosidade
- "convertido": o lead confirmou EXPLICITAMENTE que vai fechar/assinar/virar partner (ex: "pode me mandar o contrato", "vou assinar", "quero começar")
- "sem_interesse": o lead disse claramente que não tem interesse ou pediu para não ser mais contatado
- "nenhum": nada disso ficou claro nesta troca — é o padrão na dúvida

Retorne APENAS JSON sem markdown:
{"agendado":true ou false,"data_hora":"data e hora extraída em português ex: 05/06 às 15h ou null","nome_lead":"nome mencionado pelo usuário ou null","sinal_funil":"qualificado"|"convertido"|"sem_interesse"|"nenhum"}

Usuário: "${userMsg.slice(0, 300)}"
Agente: "${botMsg.slice(0, 300)}"
JSON:`,
      }],
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "{}";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return SINAL_VAZIO;
    return { ...SINAL_VAZIO, ...JSON.parse(text.slice(start, end + 1)) } as AgendamentoDetect;
  } catch {
    return SINAL_VAZIO;
  }
}

// ── Aplica agendamento: tag + status + email ────────────────────────────────

async function processarAgendamento(
  phone: string,
  dataHora: string | null,
  nomeLead: string | null
) {
  try {
    // Busca dados atuais do lead (tags existentes + responsável)
    const { data: lead } = await supabase
      .from("sdr_leads")
      .select("tags, responsavel_id, nome, status")
      .eq("phone", phone)
      .single();

    // Só processa se ainda não estava agendado (evita duplicar notificações)
    if (lead?.status === "agendado" || lead?.status === "convertido") return;

    const tagsAtuais: string[] = Array.isArray(lead?.tags) ? lead.tags : [];
    const novasTags = tagsAtuais.includes("Agendado")
      ? tagsAtuais
      : [...tagsAtuais, "Agendado"];

    // Atualiza lead: status + tags
    await supabase.from("sdr_leads").upsert({
      phone,
      status: "agendado",
      tags: novasTags,
      nome: nomeLead ?? lead?.nome ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "phone", ignoreDuplicates: false });

    console.log(`[SDR Webhook] Agendamento detectado para ${phone} — ${dataHora ?? "sem horário definido"}`);

    // Envia email ao responsável se houver um atribuído
    if (lead?.responsavel_id) {
      const { data: responsavel } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", lead.responsavel_id)
        .single();

      if (responsavel?.email) {
        await notifyAgendamentoSDR({
          responsavelEmail: responsavel.email,
          responsavelNome: responsavel.full_name ?? "Responsável",
          phone,
          nomeLead: nomeLead ?? lead?.nome ?? null,
          dataHora,
        });
        console.log(`[SDR Webhook] E-mail de agendamento enviado para ${responsavel.email}`);
      }
    } else {
      // Sem responsável: notifica admin padrão
      const adminEmail = process.env.ADMIN_EMAIL ?? "operacional@v3partners.com.br";
      await notifyAgendamentoSDR({
        responsavelEmail: adminEmail,
        responsavelNome: "Equipe V3",
        phone,
        nomeLead: nomeLead ?? lead?.nome ?? null,
        dataHora,
      });
      console.log(`[SDR Webhook] E-mail de agendamento enviado para admin (sem responsável atribuído)`);
    }

    await syncSdrLeadToProspeccao({
      phone, status: "agendado",
      nome: nomeLead ?? lead?.nome ?? null,
      responsavel_id: lead?.responsavel_id ?? null,
      nota: `Reunião agendada automaticamente pelo Agente SDR${dataHora ? ` — ${dataHora}` : ""}`,
    });
  } catch (e) {
    console.error("[SDR Webhook] Erro ao processar agendamento:", e);
  }
}

// ── Aplica sinal de funil (qualificado/convertido/sem_interesse): status + vínculo com Prospecção ──

const SINAL_PARA_STATUS: Record<Exclude<SinalFunil, "nenhum">, string> = {
  qualificado: "qualificado",
  convertido: "convertido",
  sem_interesse: "sem_interesse",
};

// Ordem de avanço do status no CRM do WhatsApp — evita que um sinal fraco regrida um lead já avançado
const STATUS_RANK: Record<string, number> = {
  ativo: 0, qualificado: 1, agendado: 2, convertido: 3, sem_interesse: -1, arquivado: -1,
};

async function processarSinalFunil(phone: string, sinal: Exclude<SinalFunil, "nenhum">) {
  try {
    const { data: lead } = await supabase
      .from("sdr_leads")
      .select("nome, responsavel_id, status")
      .eq("phone", phone)
      .single();

    const statusAlvo = SINAL_PARA_STATUS[sinal];
    const statusAtual = lead?.status ?? "ativo";

    // "sem_interesse" sempre pode ser aplicado (exceto se já convertido); os demais só avançam
    const deveAtualizar = sinal === "sem_interesse"
      ? statusAtual !== "convertido"
      : (STATUS_RANK[statusAlvo] ?? 0) > (STATUS_RANK[statusAtual] ?? 0);

    if (deveAtualizar) {
      await supabase.from("sdr_leads").upsert({
        phone, status: statusAlvo, updated_at: new Date().toISOString(),
      }, { onConflict: "phone", ignoreDuplicates: false });
      console.log(`[SDR Webhook] Sinal de funil "${sinal}" detectado para ${phone} — status atualizado`);
    }

    await syncSdrLeadToProspeccao({
      phone, status: statusAlvo,
      nome: lead?.nome ?? null,
      responsavel_id: lead?.responsavel_id ?? null,
      nota: `Sinal "${sinal}" detectado automaticamente pelo Agente SDR na conversa`,
    });
  } catch (e) {
    console.error("[SDR Webhook] Erro ao processar sinal de funil:", e);
  }
}

// ── Processa mensagem SDR ───────────────────────────────────────────────────

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

    // Delay humanizado: tempo de "leitura" antes de começar a responder (1,5-3s)
    const delayLeitura = 1500 + Math.floor(Math.random() * 1500);
    await new Promise(r => setTimeout(r, delayLeitura));

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: `Você é o Matheus, consultor de relacionamento da V3 Partners — uma boutique institucional de estruturação financeira e securitização.

Você representa uma empresa séria e de alto padrão. Seu tom é profissional, caloroso e consultivo. Você escreve como um humano experiente, não como um robô.

**Sobre a V3 Partners:**
- Boutique especializada em securitização de crédito, Real Estate estruturado, mineração/commodities e M&A cross-border
- Infraestrutura white label Bloxs S.A. (tokenização, KYC, liquidação OTC/cripto 24/7)
- Rede de Partners: Starter R$297/mês (20% comissão), Partner R$497/mês (30%), Partner PRO R$897/mês (50% + co-branding) ou Enterprise R$2.500+/mês (comissionamento negociável)
- Plataforma SaaS exclusiva com CRM, pipeline M&A, mesa de crédito e squads de IA

**Seu papel:**
1. Cumprimentar com naturalidade, sem exageros
2. Entender o perfil e o momento do lead (área, empresa, interesse)
3. Apresentar a V3 Partners de forma contextualizada ao perfil dele
4. Qualificar: quer ser partner, captar recursos, estruturar operação ou investir?
5. Se qualificado, agendar uma apresentação com um dos sócios via Google Meet
6. Coletar: nome completo, empresa e melhor horário

**Regras de comunicação — MUITO IMPORTANTE:**
- Escreva exatamente como alguém digitando rápido no WhatsApp: frases curtas e diretas
- Cada frase sua deve ter no máximo ~15 palavras
- Nunca escreva mais de 2 frases seguidas sem quebrar
- Se precisar falar de mais de uma coisa (ex: apresentar a empresa E qualificar), separe as ideias em parágrafos curtos com uma linha em branco entre eles — cada parágrafo vira uma mensagem separada no WhatsApp, então prefira várias mensagens curtas a uma única mensagem longa
- Nunca use bullet points, markdown ou asteriscos
- Nunca use emojis excessivos ou linguagem de chatbot
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

    // Envia como várias mensagens curtas em sequência (um parágrafo = uma mensagem),
    // com uma pequena pausa "digitando" entre elas, ao invés de um bloco único de texto.
    const partesMensagem = resposta
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);

    for (let i = 0; i < partesMensagem.length; i++) {
      if (i > 0) {
        const pausaDigitando = 700 + Math.min(partesMensagem[i].length * 25, 1500) + Math.floor(Math.random() * 400);
        await new Promise(r => setTimeout(r, pausaDigitando));
      }
      await fetch(
        `${process.env.EVOLUTION_API_URL}/message/sendText/${instance}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.EVOLUTION_API_KEY!,
          },
          body: JSON.stringify({ number: phone, text: partesMensagem[i] }),
        }
      );
    }

    console.log(`[SDR Webhook] Resposta enviada para ${phone} (${partesMensagem.length} mensagem(ns))`);

    // Detecta agendamento e progressão de funil na troca de mensagens (fire-and-forget)
    detectarAgendamento(mensagem, resposta).then(detect => {
      if (detect.agendado) {
        processarAgendamento(phone, detect.data_hora, detect.nome_lead);
      }
      if (detect.sinal_funil !== "nenhum") {
        processarSinalFunil(phone, detect.sinal_funil);
      }
    }).catch(e => console.error("[SDR Webhook] Erro na detecção de agendamento/funil:", e));

  } catch (e) {
    console.error("[SDR Webhook] Erro ao processar mensagem:", e);
  }
}

// Núcleo compartilhado do Agente SDR — extraído de app/api/sdr/webhook/route.ts
// (18/08/2026) pra funcionar em mais de um canal (WhatsApp hoje, Instagram
// Direct em seguida) sem duplicar o prompt, a detecção de agendamento/funil
// e a lógica de progressão de status. Cada canal só precisa fornecer sua
// própria função de envio — o "cérebro" é o mesmo.

import { createClient } from "@supabase/supabase-js";
import { notifyAgendamentoSDR } from "@/lib/email";
import { syncSdrLeadToProspeccao } from "@/lib/sdr-prospeccao-sync";
import { formatQuickReplyBlock, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";

export type SdrCanal = "whatsapp" | "instagram";

// Opções oferecidas automaticamente quando a IA detecta que o lead qualificou.
// Só usado no WhatsApp (simulado por texto) — Instagram tem quick replies
// nativos da API, que ainda não estão implementados aqui.
const OFERTA_QUALIFICADO: QuickReplyOption[] = [
  { key: "1", label: "Tenho interesse" },
  { key: "2", label: "Agendar apresentação" },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Detecção de agendamento via Haiku ───────────────────────────────────────

type SinalFunil = "nenhum" | "qualificado" | "convertido" | "sem_interesse";

type AgendamentoDetect = {
  agendado: boolean;
  data_hora: string | null;
  nome_lead: string | null;
  sinal_funil: SinalFunil;
};

const SINAL_VAZIO: AgendamentoDetect = { agendado: false, data_hora: null, nome_lead: null, sinal_funil: "nenhum" };

async function detectarAgendamento(userMsg: string, botMsg: string): Promise<AgendamentoDetect> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Analise esta troca de mensagens entre um lead e um agente de vendas (SDR) e classifique o momento do funil.

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

async function processarAgendamento(phone: string, dataHora: string | null, nomeLead: string | null) {
  try {
    const { data: lead } = await supabase
      .from("sdr_leads")
      .select("tags, responsavel_id, nome, status")
      .eq("phone", phone)
      .single();

    if (lead?.status === "agendado" || lead?.status === "convertido") return;

    const tagsAtuais: string[] = Array.isArray(lead?.tags) ? lead.tags : [];
    const novasTags = tagsAtuais.includes("Agendado") ? tagsAtuais : [...tagsAtuais, "Agendado"];

    await supabase.from("sdr_leads").upsert({
      phone,
      status: "agendado",
      tags: novasTags,
      nome: nomeLead ?? lead?.nome ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "phone", ignoreDuplicates: false });

    console.log(`[SDR Agent] Agendamento detectado para ${phone} — ${dataHora ?? "sem horário definido"}`);

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
      }
    } else {
      const adminEmail = process.env.ADMIN_EMAIL ?? "operacional@v3partners.com.br";
      await notifyAgendamentoSDR({
        responsavelEmail: adminEmail,
        responsavelNome: "Equipe V3",
        phone,
        nomeLead: nomeLead ?? lead?.nome ?? null,
        dataHora,
      });
    }

    await syncSdrLeadToProspeccao({
      phone, status: "agendado",
      nome: nomeLead ?? lead?.nome ?? null,
      responsavel_id: lead?.responsavel_id ?? null,
      nota: `Reunião agendada automaticamente pelo Agente SDR${dataHora ? ` — ${dataHora}` : ""}`,
    });
  } catch (e) {
    console.error("[SDR Agent] Erro ao processar agendamento:", e);
  }
}

// ── Aplica sinal de funil: status + vínculo com Prospecção ─────────────────

const SINAL_PARA_STATUS: Record<Exclude<SinalFunil, "nenhum">, string> = {
  qualificado: "qualificado",
  convertido: "convertido",
  sem_interesse: "sem_interesse",
};

// Ordem de avanço do status no CRM — evita que um sinal fraco regrida um lead já avançado
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

    const deveAtualizar = sinal === "sem_interesse"
      ? statusAtual !== "convertido"
      : (STATUS_RANK[statusAlvo] ?? 0) > (STATUS_RANK[statusAtual] ?? 0);

    if (deveAtualizar) {
      await supabase.from("sdr_leads").upsert({
        phone, status: statusAlvo, updated_at: new Date().toISOString(),
      }, { onConflict: "phone", ignoreDuplicates: false });
      console.log(`[SDR Agent] Sinal de funil "${sinal}" detectado para ${phone} — status atualizado`);
    }

    await syncSdrLeadToProspeccao({
      phone, status: statusAlvo,
      nome: lead?.nome ?? null,
      responsavel_id: lead?.responsavel_id ?? null,
      nota: `Sinal "${sinal}" detectado automaticamente pelo Agente SDR na conversa`,
    });
  } catch (e) {
    console.error("[SDR Agent] Erro ao processar sinal de funil:", e);
  }
}

// O prompt já proíbe markdown/bullets, mas o modelo às vezes ignora a instrução —
// no chat isso aparece como asterisco/traço literal, parecendo robótico.
function stripChatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[ \t]*[-*•]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "");
}

// ── Monta o system prompt a partir do Flow Builder (sdr_flow_config/sdr_flow_stages) ──
// Se as tabelas ainda não existirem (migration não aplicada) ou estiverem vazias,
// cai no roteiro padrão abaixo — o bot nunca fica sem prompt.

const PROMPT_PADRAO = `Você é o Matheus, consultor de relacionamento da V3 Partners — uma boutique institucional de estruturação financeira e securitização.

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
- Escreva exatamente como alguém digitando rápido no celular: frases curtas e diretas
- Cada frase sua deve ter no máximo ~10 palavras
- No máximo 1 frase por parágrafo — raramente 2, nunca mais que isso
- Resposta inteira com no máximo 3 parágrafos curtos (3 mensagens) — se não couber, fale só o essencial agora e continue no próximo turno
- Se precisar falar de mais de uma coisa (ex: apresentar a empresa E qualificar), separe as ideias em parágrafos curtos com uma linha em branco entre eles — cada parágrafo vira uma mensagem separada, então prefira várias mensagens curtas a uma única mensagem longa
- Nunca use bullet points, markdown ou asteriscos
- Nunca use emojis excessivos ou linguagem de chatbot
- Nunca invente taxas, retornos ou produtos específicos — diga que os detalhes serão apresentados na reunião
- Se o lead confirmar reunião, diga que um dos sócios vai entrar em contato para confirmar o link do Meet
- Lembre-se do histórico da conversa para não repetir perguntas já feitas`;

export async function buildSystemPrompt(): Promise<string> {
  try {
    const [{ data: config, error: configErr }, { data: stages, error: stagesErr }] = await Promise.all([
      supabase.from("sdr_flow_config").select("*").eq("id", "default").maybeSingle(),
      supabase.from("sdr_flow_stages").select("*").eq("ativo", true).order("ordem", { ascending: true }),
    ]);

    if (configErr || stagesErr || !config || !stages || stages.length === 0) return PROMPT_PADRAO;

    const etapas = stages.map((s, i) => `${i + 1}. ${s.titulo}: ${s.instrucoes}`).join("\n");
    const regras = String(config.regras_comunicacao ?? "")
      .split("\n").map((l: string) => l.trim()).filter(Boolean).map((l: string) => `- ${l}`).join("\n");

    return `Você é o ${config.agente_nome}, consultor de relacionamento da V3 Partners — uma boutique institucional de estruturação financeira e securitização.

${config.empresa_contexto}

**Seu papel:**
${etapas}

**Regras de comunicação — MUITO IMPORTANTE:**
${regras}`;
  } catch {
    return PROMPT_PADRAO;
  }
}

// ── Núcleo: processa mensagem e responde, independente do canal ────────────
//
// `phone` é o identificador do contato no canal (número de verdade no
// WhatsApp, IGSID no Instagram — ver comentário na migration
// 20260819_sdr_canal_instagram.sql). `enviarTexto` é quem sabe como entregar
// uma mensagem de texto nesse canal específico; este núcleo não conhece
// OpenWA nem Graph API diretamente.

export async function processarMensagemSDRCore(params: {
  phone: string;
  mensagem: string;
  instance: string;
  canal: SdrCanal;
  enviarTexto: (texto: string) => Promise<void>;
}) {
  const { phone, mensagem, instance, canal, enviarTexto } = params;
  try {
    // Busca as 40 mensagens mais RECENTES (desc + limit) e devolve pra ordem
    // cronológica depois — pegar ascendente direto travava a IA nas primeiras
    // 40 mensagens da conversa inteira assim que ela passava desse tamanho.
    // Filtra por canal também: mesmo phone/IGSID nunca deveria colidir entre
    // canais na prática, mas evita cross-contamination se algum dia colidir.
    const { data: historico } = await supabase
      .from("sdr_conversas")
      .select("role, content")
      .eq("phone", phone)
      .eq("canal", canal)
      .order("created_at", { ascending: false })
      .limit(40);

    const messages = (historico || []).reverse().map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

    // A Anthropic exige que a conversa termine em "user". Entregas concorrentes
    // do mesmo webhook (retry) podem intercalar um "assistant" já respondido
    // por outra execução por cima da mensagem atual — apara qualquer cauda.
    while (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      messages.pop();
    }
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      console.log(`[SDR Agent] Histórico sem mensagem de usuário no final para ${phone} (${canal}) — pulando resposta (provável entrega duplicada)`);
      return;
    }

    // Delay humanizado: tempo de "leitura" antes de começar a responder (3-6s)
    const delayLeitura = 3000 + Math.floor(Math.random() * 3000);
    await new Promise((r) => setTimeout(r, delayLeitura));

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const systemPrompt = await buildSystemPrompt();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 180,
      system: systemPrompt,
      messages,
    });

    const respostaBruta = response.content[0].type === "text" ? response.content[0].text : "";
    if (!respostaBruta) return;
    const resposta = stripChatMarkdown(respostaBruta);

    // Detecta agendamento e progressão de funil ANTES de enviar — precisa do
    // resultado agora (não só fire-and-forget) pra decidir se oferece opções
    // de resposta rápida nesta mesma resposta.
    const detect = await detectarAgendamento(mensagem, resposta);

    let respostaFinal = resposta;
    let quickReplyOptions: QuickReplyOption[] | null = null;
    // Quick reply simulado por texto é hack específico do WhatsApp (a API não
    // oficial não suporta botão nativo) — Instagram tem quick replies nativos
    // da própria API, ainda não implementados aqui, então não anexa o bloco.
    if (canal === "whatsapp" && detect.sinal_funil === "qualificado") {
      const { data: jaOfereceu } = await supabase
        .from("sdr_conversas")
        .select("id")
        .eq("phone", phone)
        .eq("canal", canal)
        .not("quick_reply_options", "is", null)
        .limit(1)
        .maybeSingle();

      if (!jaOfereceu) {
        quickReplyOptions = OFERTA_QUALIFICADO;
        respostaFinal = `${resposta}\n\n${formatQuickReplyBlock(quickReplyOptions)}`;
      }
    }

    await supabase.from("sdr_conversas").insert({
      phone,
      canal,
      role: "assistant",
      content: respostaFinal,
      instance,
      quick_reply_options: quickReplyOptions,
    });

    // Envia como várias mensagens curtas em sequência (um parágrafo = uma
    // mensagem), com uma pequena pausa "digitando" entre elas.
    const partesMensagem = respostaFinal
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (let i = 0; i < partesMensagem.length; i++) {
      if (i > 0) {
        const pausaDigitando = 700 + Math.min(partesMensagem[i].length * 25, 1500) + Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, pausaDigitando));
      }
      await enviarTexto(partesMensagem[i]);
    }

    console.log(`[SDR Agent] Resposta enviada para ${phone} via ${canal} (${partesMensagem.length} mensagem(ns))`);

    if (detect.agendado) await processarAgendamento(phone, detect.data_hora, detect.nome_lead);
    if (detect.sinal_funil !== "nenhum") await processarSinalFunil(phone, detect.sinal_funil);
  } catch (e) {
    console.error(`[SDR Agent] Erro ao processar mensagem (${canal}):`, e);
  }
}

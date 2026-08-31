// Núcleo compartilhado do Agente SDR — extraído de app/api/sdr/webhook/route.ts
// (18/08/2026) pra funcionar em mais de um canal (WhatsApp hoje, Instagram
// Direct em seguida) sem duplicar o prompt, a detecção de agendamento/funil
// e a lógica de progressão de status. Cada canal só precisa fornecer sua
// própria função de envio — o "cérebro" é o mesmo.

import { createClient } from "@supabase/supabase-js";
import { notifyAgendamentoSDR } from "@/lib/email";
import { syncSdrLeadToProspeccao } from "@/lib/sdr-prospeccao-sync";
import { formatQuickReplyBlock, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import { listAvailableSlots, withTracking, type CalendlySlot } from "@/lib/calendly";
import { chatComplete, AiProviderError, type AiProvider } from "@/lib/ai/registry";
import { decryptSecret } from "@/lib/crypto/secret";

export type SdrCanal = "whatsapp" | "instagram" | "messenger" | "telegram";

// UUID sentinela usado em sdr_leads.partner_id pro bot interno da V3 (não
// referencia nenhum profiles.id de verdade — ver migration
// 20260823_sdr_whitelabel_partner.sql pro motivo de não usar NULL ali).
export const SDR_INTERNO_PARTNER_ID = "00000000-0000-0000-0000-000000000000";

// Opções oferecidas automaticamente quando a IA detecta que o lead qualificou.
// Simulado por texto (ver lib/whatsapp/quick-reply.ts) — mesmo método nos 4
// canais (whatsapp/instagram/messenger/telegram), mesmo os 3 últimos tendo
// suporte nativo a botão na própria API: manter um único mecanismo evita
// duplicar a lógica de resolução da resposta do lead ("1", "2"...) por canal.
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
  /** Label exata (igual às oferecidas) do horário que o lead confirmou nesta troca, ou null. */
  horario_confirmado: string | null;
};

const SINAL_VAZIO: AgendamentoDetect = { agendado: false, data_hora: null, nome_lead: null, sinal_funil: "nenhum", horario_confirmado: null };

async function detectarAgendamento(userMsg: string, botMsg: string, slotsOferecidos: CalendlySlot[]): Promise<AgendamentoDetect> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const listaSlots = slotsOferecidos.map((s) => `"${s.labelPtBR}"`).join(", ");

    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Analise esta troca de mensagens entre um lead e um agente de vendas (SDR) e classifique o momento do funil.

Um agendamento é confirmado quando o usuário aceita ou sugere data/hora E o agente confirma.

Horários que o agente tinha disponível pra oferecer nesta conversa: [${listaSlots || "nenhum"}].

sinal_funil (escolha o que MAIS se aplica, seja conservador — só marque se houver confirmação clara e explícita, não apenas educação/interesse superficial):
- "qualificado": o lead demonstrou claramente que o perfil se encaixa (quer ser partner, tem carteira de clientes, quer estruturar operação) — mais que curiosidade
- "convertido": o lead confirmou EXPLICITAMENTE que vai fechar/assinar/virar partner (ex: "pode me mandar o contrato", "vou assinar", "quero começar")
- "sem_interesse": o lead disse claramente que não tem interesse ou pediu para não ser mais contatado
- "nenhum": nada disso ficou claro nesta troca — é o padrão na dúvida

Retorne APENAS JSON sem markdown:
{"agendado":true ou false,"data_hora":"data e hora extraída em português ex: 05/06 às 15h ou null","nome_lead":"nome mencionado pelo usuário ou null","sinal_funil":"qualificado"|"convertido"|"sem_interesse"|"nenhum","horario_confirmado":"copie EXATAMENTE uma das labels da lista de horários acima se o lead confirmou esse horário nesta troca, senão null"}

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

async function processarAgendamento(phone: string, dataHora: string | null, nomeLead: string | null, partnerId: string | null) {
  const partnerIdColuna = partnerId ?? SDR_INTERNO_PARTNER_ID;
  try {
    const { data: lead } = await supabase
      .from("sdr_leads")
      .select("tags, responsavel_id, nome, status")
      .eq("phone", phone)
      .eq("partner_id", partnerIdColuna)
      .single();

    if (lead?.status === "agendado" || lead?.status === "convertido") return;

    const tagsAtuais: string[] = Array.isArray(lead?.tags) ? lead.tags : [];
    const novasTags = tagsAtuais.includes("Agendado") ? tagsAtuais : [...tagsAtuais, "Agendado"];

    await supabase.from("sdr_leads").upsert({
      phone,
      partner_id: partnerIdColuna,
      status: "agendado",
      tags: novasTags,
      nome: nomeLead ?? lead?.nome ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "phone,partner_id", ignoreDuplicates: false });

    console.log(`[SDR Agent] Agendamento detectado para ${phone} — ${dataHora ?? "sem horário definido"}`);

    // Instância de partner: notifica o próprio partner (é o dono do lead),
    // não a equipe interna da V3 — cada um cuida da própria agenda.
    if (partnerId) {
      const { data: partner } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", partnerId)
        .single();

      if (partner?.email) {
        await notifyAgendamentoSDR({
          responsavelEmail: partner.email,
          responsavelNome: partner.full_name ?? "Responsável",
          phone,
          nomeLead: nomeLead ?? lead?.nome ?? null,
          dataHora,
        });
      }
    } else if (lead?.responsavel_id) {
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

    // Sincronização com o CRM de Prospecção é só do bot interno da V3 — o
    // pipeline de prospeccao_leads é pra prospectar NOVOS partners, não faz
    // sentido puxar leads de clientes de um partner pra lá.
    if (!partnerId) {
      await syncSdrLeadToProspeccao({
        phone, status: "agendado",
        nome: nomeLead ?? lead?.nome ?? null,
        responsavel_id: lead?.responsavel_id ?? null,
        nota: `Reunião agendada automaticamente pelo Agente SDR${dataHora ? ` — ${dataHora}` : ""}`,
      });
    }
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

async function processarSinalFunil(phone: string, sinal: Exclude<SinalFunil, "nenhum">, partnerId: string | null) {
  const partnerIdColuna = partnerId ?? SDR_INTERNO_PARTNER_ID;
  try {
    const { data: lead } = await supabase
      .from("sdr_leads")
      .select("nome, responsavel_id, status")
      .eq("phone", phone)
      .eq("partner_id", partnerIdColuna)
      .single();

    const statusAlvo = SINAL_PARA_STATUS[sinal];
    const statusAtual = lead?.status ?? "ativo";

    const deveAtualizar = sinal === "sem_interesse"
      ? statusAtual !== "convertido"
      : (STATUS_RANK[statusAlvo] ?? 0) > (STATUS_RANK[statusAtual] ?? 0);

    if (deveAtualizar) {
      await supabase.from("sdr_leads").upsert({
        phone, partner_id: partnerIdColuna, status: statusAlvo, updated_at: new Date().toISOString(),
      }, { onConflict: "phone,partner_id", ignoreDuplicates: false });
      console.log(`[SDR Agent] Sinal de funil "${sinal}" detectado para ${phone} — status atualizado`);
    }

    // Ver comentário equivalente em processarAgendamento: só sincroniza com o
    // CRM interno de Prospecção quando é o bot interno da V3.
    if (!partnerId) {
      await syncSdrLeadToProspeccao({
        phone, status: statusAlvo,
        nome: lead?.nome ?? null,
        responsavel_id: lead?.responsavel_id ?? null,
        nota: `Sinal "${sinal}" detectado automaticamente pelo Agente SDR na conversa`,
      });
    }
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
- Se o lead confirmar um horário de reunião, apenas confirme a data e hora escolhidas — o sistema já anexa o link de confirmação automaticamente
- Lembre-se do histórico da conversa para não repetir perguntas já feitas`;

// Interruptor por canal: quando desligado para um canal, nenhum webhook
// desse canal dispara resposta automática da IA, em nenhuma conversa (o
// outro canal não é afetado). Falha aberta (retorna true) se a
// coluna/linha ainda não existir — a IA nunca fica muda por causa de um
// erro de leitura de config, só por ação explícita do admin.
const IA_ATIVA_COLUNA: Record<SdrCanal, "ia_ativa_whatsapp" | "ia_ativa_instagram" | "ia_ativa_messenger" | "ia_ativa_telegram"> = {
  whatsapp: "ia_ativa_whatsapp",
  instagram: "ia_ativa_instagram",
  messenger: "ia_ativa_messenger",
  telegram: "ia_ativa_telegram",
};

export async function isIaAtiva(canal: SdrCanal, partnerId: string | null = null): Promise<boolean> {
  try {
    const query = supabase
      .from("sdr_flow_config")
      .select("ia_ativa_whatsapp, ia_ativa_instagram, ia_ativa_messenger, ia_ativa_telegram");
    const { data, error } = await (partnerId ? query.eq("partner_id", partnerId) : query.eq("id", "default")).maybeSingle();
    if (error || !data) return true;
    const coluna = IA_ATIVA_COLUNA[canal];
    const valor = (data as Record<string, boolean>)[coluna];
    return valor !== false;
  } catch {
    return true;
  }
}

// Bloco de horários reais anexado ao system prompt — a IA só pode oferecer
// os horários desta lista, nunca inventar data/hora. Vazio quando a consulta
// ao Calendly falhou ou não há vaga nos próximos dias.
function buildBlocoHorarios(slots: CalendlySlot[]): string {
  if (slots.length === 0) return "";
  const lista = slots.slice(0, 8).map((s) => `- ${s.labelPtBR}`).join("\n");
  return `\n\n**Horários reais disponíveis pra agendar (horário de Brasília) — só ofereça agendamento se o lead já estiver qualificado, e use exatamente um destes horários, nunca invente outro:**\n${lista}\n\nQuando o lead confirmar um desses horários, repita a data e hora exatas na sua resposta pra confirmar — o sistema vai anexar automaticamente o link de confirmação.`;
}

// Etapas genéricas usadas no prompt de um partner — sdr_flow_stages (o editor
// visual de etapas) continua sendo só do bot interno da V3; não faz sentido
// expor esse builder pros partners nesta fase (só pediram nome/contexto/regras
// configuráveis). Um roteiro fixo e neutro é suficiente pra maioria dos usos.
const ETAPAS_GENERICAS_PARTNER = `1. Cumprimentar com naturalidade, sem exageros
2. Entender o que o lead precisa e o momento dele
3. Apresentar o que você (o agente) representa, de forma contextualizada
4. Qualificar o interesse real do lead
5. Se fizer sentido, propor um próximo passo (reunião, ligação, envio de material)
6. Coletar os dados necessários pra dar esse próximo passo`;

const REGRAS_GENERICAS_PARTNER = `- Escreva exatamente como alguém digitando rápido no celular: frases curtas e diretas
- Cada frase sua deve ter no máximo ~10 palavras
- No máximo 1 frase por parágrafo — raramente 2, nunca mais que isso
- Resposta inteira com no máximo 3 parágrafos curtos — se não couber, fale só o essencial agora e continue no próximo turno
- Nunca use bullet points, markdown ou asteriscos
- Nunca use emojis excessivos ou linguagem de chatbot
- Nunca invente informações, preços ou condições que você não tem certeza
- Lembre-se do histórico da conversa para não repetir perguntas já feitas`;

// Fallback pro partner que ainda não configurou a própria IA (ou cuja linha
// de sdr_flow_config sumiu por algum erro) — NUNCA cai no PROMPT_PADRAO, que
// é a V3 se vendendo; isso faria o bot do partner promover a V3 pros
// clientes DELE, o que é exatamente o oposto do produto white label.
function promptFallbackPartner(): string {
  return `Você é um assistente de atendimento via WhatsApp. Seu tom é profissional, caloroso e consultivo. Você escreve como um humano experiente, não como um robô.

**Seu papel:**
${ETAPAS_GENERICAS_PARTNER}

**Regras de comunicação — MUITO IMPORTANTE:**
${REGRAS_GENERICAS_PARTNER}`;
}

// ── Agente configurável (sdr_agents) — Fase 1 ──────────────────────────────
// Carrega o agente ATIVO do dono (partner ou bot interno da V3). Quando não há
// nenhum, o runtime continua com o caminho legado (Anthropic SDK + prompt do
// Flow Builder), sem regressão.

type AgentConfig = {
  provider: AiProvider;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  api_key_encrypted: string | null;
};

async function loadAgentConfig(partnerId: string | null): Promise<AgentConfig | null> {
  const owner = partnerId ?? SDR_INTERNO_PARTNER_ID;
  try {
    const { data } = await supabase
      .from("sdr_agents")
      .select("provider, model, temperature, max_tokens, system_prompt, api_key_encrypted")
      .eq("owner_partner_id", owner)
      .eq("enabled", true)
      .maybeSingle();
    if (!data) return null;
    return {
      provider: data.provider as AiProvider,
      model: data.model as string,
      temperature: Number(data.temperature ?? 0.6),
      max_tokens: Number(data.max_tokens ?? 180),
      system_prompt: (data.system_prompt as string) ?? "",
      api_key_encrypted: (data.api_key_encrypted as string | null) ?? null,
    };
  } catch {
    return null; // tabela ainda não migrada → caminho legado
  }
}

function resolveAgentKey(cfg: AgentConfig): string | null {
  if (cfg.api_key_encrypted) {
    try { return decryptSecret(cfg.api_key_encrypted); } catch { return null; }
  }
  // Sem chave própria: só o provedor Anthropic pode cair na chave global da V3.
  if (cfg.provider === "anthropic") return process.env.ANTHROPIC_API_KEY ?? null;
  return null;
}

export async function buildSystemPrompt(partnerId: string | null = null): Promise<string> {
  try {
    if (partnerId) {
      const { data: config, error: configErr } = await supabase
        .from("sdr_flow_config").select("*").eq("partner_id", partnerId).maybeSingle();
      if (configErr || !config) return promptFallbackPartner();

      const regras = String(config.regras_comunicacao ?? "").trim() || REGRAS_GENERICAS_PARTNER;
      return `Você é o ${config.agente_nome}${config.empresa_contexto ? `.\n\n${config.empresa_contexto}` : ", um assistente de atendimento via WhatsApp."}

**Seu papel:**
${ETAPAS_GENERICAS_PARTNER}

**Regras de comunicação — MUITO IMPORTANTE:**
${regras}`;
    }

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
    return partnerId ? promptFallbackPartner() : PROMPT_PADRAO;
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
  /** null = bot interno da V3 (comportamento atual). Preenchido = instância white label desse partner. */
  partnerId?: string | null;
  /** created_at (ISO) da linha em sdr_conversas que disparou esta execução — usado
   * pelo anti-double-reply logo abaixo. Opcional só pra não quebrar chamadores antigos. */
  mensagemCreatedAt?: string | null;
}) {
  const { phone, mensagem, instance, canal, enviarTexto, partnerId = null, mensagemCreatedAt = null } = params;
  try {
    // Busca as 40 mensagens mais RECENTES (desc + limit) e devolve pra ordem
    // cronológica depois — pegar ascendente direto travava a IA nas primeiras
    // 40 mensagens da conversa inteira assim que ela passava desse tamanho.
    // Filtra por canal também: mesmo phone/IGSID nunca deveria colidir entre
    // canais na prática, mas evita cross-contamination se algum dia colidir.
    // Filtra por partner_id (ou IS NULL pro bot interno) pra isolar
    // completamente a conversa de cada instância white label.
    let historicoQuery = supabase
      .from("sdr_conversas")
      .select("role, content")
      .eq("phone", phone)
      .eq("canal", canal);
    historicoQuery = partnerId ? historicoQuery.eq("partner_id", partnerId) : historicoQuery.is("partner_id", null);
    const { data: historico } = await historicoQuery
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

    // Anti-resposta-dupla: cada mensagem recebida dispara sua PRÓPRIA execução
    // deste núcleo (um webhook por mensagem) — se o lead manda várias
    // mensagens em sequência rápida, várias execuções corriam em paralelo e
    // cada uma respondia por conta própria (2, às vezes 3 respostas
    // seguidas pro mesmo lote de mensagens). Depois do delay de leitura acima,
    // confere se já chegou uma mensagem do usuário MAIS NOVA que a que
    // disparou esta execução — se sim, desiste: a execução disparada por essa
    // mensagem mais nova vai ler o histórico completo (incluindo esta) e
    // responder ao lote inteiro de uma vez só.
    if (mensagemCreatedAt) {
      let novaQuery = supabase
        .from("sdr_conversas")
        .select("id")
        .eq("phone", phone)
        .eq("canal", canal)
        .eq("role", "user")
        .gt("created_at", mensagemCreatedAt);
      novaQuery = partnerId ? novaQuery.eq("partner_id", partnerId) : novaQuery.is("partner_id", null);
      const { data: maisNova } = await novaQuery.limit(1).maybeSingle();
      if (maisNova) {
        console.log(`[SDR Agent] Mensagem mais nova de ${phone} (${canal}) chegou durante a espera — deixando a execução dela responder ao lote inteiro`);
        return;
      }
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Horários reais do Calendly — nunca deixa a IA inventar data/hora. Se a
    // consulta falhar (token não configurado, API fora), segue sem oferecer
    // agendamento nesta resposta em vez de travar o agente inteiro. É
    // integração exclusiva da V3 (CALENDLY_EVENT_TYPE_URI é o calendário dos
    // sócios) — instâncias de partner nunca consultam nem oferecem esses
    // horários, pra não vazar a agenda da V3 pros leads DELE.
    let slotsDisponiveis: CalendlySlot[] = [];
    if (!partnerId) {
      try {
        slotsDisponiveis = await listAvailableSlots();
      } catch (e) {
        console.error("[SDR Agent] Erro ao consultar disponibilidade no Calendly:", e);
      }
    }

    const blocoHorarios = buildBlocoHorarios(slotsDisponiveis);
    const agentCfg = await loadAgentConfig(partnerId);

    let respostaBruta = "";
    if (agentCfg) {
      // Caminho novo: agente configurável (provedor/modelo/prompt do sdr_agents).
      const base = agentCfg.system_prompt.trim() || await buildSystemPrompt(partnerId);
      const systemPrompt = base + blocoHorarios;
      const apiKey = resolveAgentKey(agentCfg);
      if (apiKey) {
        try {
          const out = await chatComplete({
            provider: agentCfg.provider,
            model: agentCfg.model,
            apiKey,
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: typeof m.content === "string" ? m.content : "",
            })),
            temperature: agentCfg.temperature,
            maxTokens: agentCfg.max_tokens,
          });
          respostaBruta = out.text;
        } catch (e) {
          const msg = e instanceof AiProviderError ? `${e.provider}: ${e.message}` : String(e);
          console.error("[SDR Agent] provedor configurado falhou, caindo no legado:", msg);
        }
      } else {
        console.error(`[SDR Agent] agente ${agentCfg.provider} sem chave de API utilizável — usando legado`);
      }
    }

    if (!respostaBruta) {
      // Fallback legado: Anthropic SDK + prompt do Flow Builder.
      const systemPrompt = await buildSystemPrompt(partnerId) + blocoHorarios;
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 180,
        system: systemPrompt,
        messages,
      });
      respostaBruta = response.content[0].type === "text" ? response.content[0].text : "";
    }

    if (!respostaBruta) return;
    const resposta = stripChatMarkdown(respostaBruta);

    // Detecta agendamento e progressão de funil ANTES de enviar — precisa do
    // resultado agora (não só fire-and-forget) pra decidir se oferece opções
    // de resposta rápida nesta mesma resposta.
    const detect = await detectarAgendamento(mensagem, resposta, slotsDisponiveis);

    let respostaFinal = resposta;
    let quickReplyOptions: QuickReplyOption[] | null = null;
    // Quick reply simulado por texto — mesmo método nos 4 canais (ver
    // comentário em OFERTA_QUALIFICADO acima).
    if (detect.sinal_funil === "qualificado") {
      let jaOfereceuQuery = supabase
        .from("sdr_conversas")
        .select("id")
        .eq("phone", phone)
        .eq("canal", canal)
        .not("quick_reply_options", "is", null);
      jaOfereceuQuery = partnerId ? jaOfereceuQuery.eq("partner_id", partnerId) : jaOfereceuQuery.is("partner_id", null);
      const { data: jaOfereceu } = await jaOfereceuQuery.limit(1).maybeSingle();

      if (!jaOfereceu) {
        quickReplyOptions = OFERTA_QUALIFICADO;
        respostaFinal = `${resposta}\n\n${formatQuickReplyBlock(quickReplyOptions)}`;
      }
    }

    // Horário confirmado nesta troca — anexa o link de agendamento real
    // (rastreável, pra sabermos depois via webhook do Calendly que foi ESTE
    // lead que agendou). Só cria se ainda não há um agendamento ativo pra
    // este contato, pra não empilhar links a cada nova troca sobre o mesmo horário.
    if (detect.horario_confirmado) {
      const slotEscolhido = slotsDisponiveis.find((s) => s.labelPtBR === detect.horario_confirmado);
      if (slotEscolhido) {
        const { data: agendamentoExistente } = await supabase
          .from("sdr_agendamentos")
          .select("id")
          .eq("phone", phone)
          .eq("canal", canal)
          .in("status", ["link_enviado", "confirmado"])
          .limit(1)
          .maybeSingle();

        if (!agendamentoExistente) {
          const trackingId = crypto.randomUUID();
          const linkComTracking = withTracking(slotEscolhido.schedulingUrl, trackingId);

          const { error: agendamentoErr } = await supabase.from("sdr_agendamentos").insert({
            id: trackingId,
            phone,
            canal,
            slot_start_time: slotEscolhido.startTimeISO,
            scheduling_url: linkComTracking,
          });

          if (!agendamentoErr) {
            respostaFinal = `${respostaFinal}\n\nPra confirmar, é só clicar aqui: ${linkComTracking}`;
          } else {
            console.error("[SDR Agent] Erro ao registrar agendamento:", agendamentoErr);
          }
        }
      }
    }

    await supabase.from("sdr_conversas").insert({
      phone,
      canal,
      role: "assistant",
      content: respostaFinal,
      instance,
      quick_reply_options: quickReplyOptions,
      partner_id: partnerId,
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

    if (detect.agendado) await processarAgendamento(phone, detect.data_hora, detect.nome_lead, partnerId);
    if (detect.sinal_funil !== "nenhum") await processarSinalFunil(phone, detect.sinal_funil, partnerId);
  } catch (e) {
    console.error(`[SDR Agent] Erro ao processar mensagem (${canal}):`, e);
  }
}

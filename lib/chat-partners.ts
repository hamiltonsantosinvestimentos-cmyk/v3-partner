import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";

// Chat Partners v2 (26/10/2026). Sala de cada partner: room_id = partner_<profile id>.
// Instituições usam instituicao_<id> (rotas próprias em /api/instituicao/chat).
// Estado por sala em chat_conversas (migration 20261026_chat_partners_v2.sql). Enquanto a
// migration não roda, tudo aqui degrada para o comportamento antigo em vez de quebrar.

export const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
export const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "GOLD", "DIAMANTE", "PARTNER_HE", "ENTERPRISE"] as const;
export const ANEXOS_BUCKET = "chat-anexos";

/** SLA da primeira resposta da Mesa (horas corridas dentro do horário comercial). */
export const SLA_HORAS = Number(process.env.CHAT_SLA_HORAS || 4);

export const ehMesa = (role?: string | null) => !!role && (MESA_ROLES as readonly string[]).includes(role);
export const ehPartner = (role?: string | null) => !!role && (PARTNER_ROLES as readonly string[]).includes(role);
export const salaDoPartner = (id: string) => `partner_${id}`;

export function svc(): SupabaseClient {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Erro de tabela/coluna inexistente (migration ainda não rodada). */
export function faltaMigration(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    /does not exist|Could not find the/i.test(error.message ?? "");
}

export interface Anexo { path: string; nome: string; tipo: string; tamanho: number }

export interface Conversa {
  room_id: string;
  mesa_lido_ate: string | null;
  partner_lido_ate: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  sla_alertado_em: string | null;
}

export async function lerConversas(db: SupabaseClient, rooms?: string[]): Promise<Map<string, Conversa>> {
  let q = db.from("chat_conversas").select("room_id, mesa_lido_ate, partner_lido_ate, responsavel_id, responsavel_nome, sla_alertado_em");
  if (rooms) q = q.in("room_id", rooms);
  const { data, error } = await q;
  if (error) return new Map();
  return new Map((data as Conversa[]).map((c) => [c.room_id, c]));
}

export async function salvarConversa(db: SupabaseClient, room_id: string, campos: Partial<Omit<Conversa, "room_id">>) {
  const { error } = await db.from("chat_conversas")
    .upsert({ room_id, ...campos, updated_at: new Date().toISOString() }, { onConflict: "room_id" });
  return { ok: !error, semMigration: faltaMigration(error) };
}

/** Marca a sala como lida por um lado (Mesa ou partner) até agora. */
export async function marcarLido(db: SupabaseClient, room_id: string, lado: "mesa" | "partner") {
  return salvarConversa(db, room_id, lado === "mesa" ? { mesa_lido_ate: new Date().toISOString() } : { partner_lido_ate: new Date().toISOString() });
}

/**
 * Insere mensagem na sala do partner. Com a migration rodada grava tipo/proposta/anexos;
 * sem ela, cai para as colunas antigas (o texto continua chegando).
 */
export async function inserirMensagem(db: SupabaseClient, msg: {
  room_id: string; sender_id: string; sender_name: string; sender_role: string; content: string;
  tipo?: "mensagem" | "sistema"; proposta_id?: string | null; anexos?: Anexo[] | null;
}) {
  const base = { room_id: msg.room_id, sender_id: msg.sender_id, sender_name: msg.sender_name, sender_role: msg.sender_role, content: msg.content };
  const extra: Record<string, unknown> = {};
  if (msg.tipo && msg.tipo !== "mensagem") extra.tipo = msg.tipo;
  if (msg.proposta_id) extra.proposta_id = msg.proposta_id;
  if (msg.anexos?.length) extra.anexos = msg.anexos;
  if (Object.keys(extra).length) {
    const r = await db.from("chat_messages").insert({ ...base, ...extra }).select().single();
    if (!r.error || !faltaMigration(r.error)) return r;
    if (msg.anexos?.length) return r; // anexo sem coluna: não dá para gravar sem perder o arquivo
  }
  return db.from("chat_messages").insert(base).select().single();
}

const ETAPA_LABEL: Record<string, string> = {
  RECEBIDO: "Recebido", TRIAGEM: "Triagem", ANALISE: "Análise de crédito", PENDENCIA: "Pendência de documentos",
  AVALIACAO_IMOVEL: "Avaliação de imóvel", APROVACAO: "Em aprovação", CONTRATO_ASSINADO: "Contrato assinado",
  REGISTRO_IMOVEL: "Registro de imóveis", LIBERADO: "Recurso liberado", REPROVADO: "Reprovado", DECLINADO: "Declinado",
};
export const etapaLabel = (s?: string | null) => (s ? ETAPA_LABEL[s] ?? s : "—");

/** Aviso automático no chat do partner quando a proposta muda de etapa. */
export async function avisarMudancaEtapa(db: SupabaseClient, propostaId: string, novaEtapa: string, autor: { id: string; nome: string }) {
  const { data: p } = await db.from("credit_desk_proposals")
    .select("id, code, client_name, partner_id, pending_reason").eq("id", propostaId).single();
  if (!p?.partner_id) return;
  const { data: dono } = await db.from("profiles").select("role").eq("id", p.partner_id).single();
  if (!ehPartner(dono?.role as string)) return;
  const icone = novaEtapa === "LIBERADO" ? "🎉" : novaEtapa === "PENDENCIA" ? "⚠️" : ["REPROVADO", "DECLINADO"].includes(novaEtapa) ? "📕" : "📌";
  let texto = `${icone} Proposta ${p.code} (${p.client_name ?? "cliente"}) agora está em: ${etapaLabel(novaEtapa)}.`;
  if (novaEtapa === "PENDENCIA") texto += p.pending_reason ? `\nO que falta: ${p.pending_reason}` : "\nVeja na aba Documentos da proposta o que falta enviar.";
  if (novaEtapa === "LIBERADO") texto += "\nA comissão foi gerada e aparece em Comissões assim que o financeiro autorizar.";
  await inserirMensagem(db, {
    room_id: salaDoPartner(p.partner_id), sender_id: autor.id, sender_name: "Mesa V3 · aviso automático",
    sender_role: "SYSTEM", content: texto, tipo: "sistema", proposta_id: p.id,
  });
}

/** Aviso automático no chat do partner quando o financeiro marca a comissão como paga. */
export async function avisarComissaoPaga(db: SupabaseClient, partnerId: string,
  c: { code: string; operacao?: string | null; liquido: number; data?: string | null }, autor: { id: string; nome: string }) {
  const { data: dono } = await db.from("profiles").select("role").eq("id", partnerId).single();
  if (!ehPartner(dono?.role as string)) return;
  const valor = c.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const quando = c.data ? ` em ${new Date(`${c.data}T12:00:00`).toLocaleDateString("pt-BR")}` : "";
  await inserirMensagem(db, {
    room_id: salaDoPartner(partnerId), sender_id: autor.id, sender_name: "Mesa V3 · aviso automático", sender_role: "SYSTEM",
    content: `💰 Comissão ${c.code}${c.operacao ? ` (${c.operacao})` : ""} paga${quando}: ${valor} líquido. O comprovante foi enviado por e-mail e está em Comissões.`,
    tipo: "sistema",
  });
}

// ─── SLA ─────────────────────────────────────────────────────────────────────

/** Horário comercial de Brasília: seg–sex, 8h–19h. */
export function horarioComercial(d = new Date()): boolean {
  const br = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = br.getDay(), h = br.getHours();
  return dia >= 1 && dia <= 5 && h >= 8 && h < 19;
}

export interface Espera { room_id: string; partner_id: string; desde: string; ultima: string; preview: string }

/** Salas cuja última mensagem é do partner (aguardando a Mesa), com o início da espera. */
export function calcularEsperas(msgs: { room_id: string; sender_role: string; created_at: string; content: string; tipo?: string | null }[]): Map<string, Espera> {
  const porSala = new Map<string, typeof msgs>();
  for (const m of msgs) {
    if (!m.room_id.startsWith("partner_")) continue;
    (porSala.get(m.room_id) ?? porSala.set(m.room_id, []).get(m.room_id)!).push(m);
  }
  const esperas = new Map<string, Espera>();
  for (const [room_id, lista] of porSala) {
    const ord = [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let inicio: (typeof ord)[number] | null = null;
    for (const m of ord) {
      const daMesa = ehMesa(m.sender_role) || m.sender_role === "SYSTEM" || m.tipo === "sistema";
      if (daMesa) inicio = null;
      else if (!inicio) inicio = m;
    }
    if (inicio) {
      const ultima = ord[ord.length - 1];
      esperas.set(room_id, { room_id, partner_id: room_id.slice(8), desde: inicio.created_at, ultima: ultima.created_at, preview: ultima.content.slice(0, 120) });
    }
  }
  return esperas;
}

/** Chamado pelo pg_cron por minuto: alerta a Mesa quando um partner passa do SLA sem resposta. */
export async function verificarSlaChat(db: SupabaseClient, enviarWhatsapp: (texto: string) => Promise<unknown>): Promise<number> {
  if (!horarioComercial()) return 0;
  const desde = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: msgs } = await db.from("chat_messages")
    .select("room_id, sender_role, created_at, content").like("room_id", "partner_%").gte("created_at", desde)
    .order("created_at", { ascending: true }).limit(5000);
  const esperas = [...calcularEsperas((msgs ?? []) as never[]).values()]
    .filter((e) => Date.now() - Date.parse(e.desde) > SLA_HORAS * 36e5);
  if (!esperas.length) return 0;

  const conversas = await lerConversas(db, esperas.map((e) => e.room_id));
  if (!conversas.size && esperas.length) {
    // Sem a tabela não há como evitar alerta repetido: não alerta.
    const { error } = await db.from("chat_conversas").select("room_id").limit(1);
    if (faltaMigration(error)) return 0;
  }
  const { data: partners } = await db.from("profiles").select("id, full_name").in("id", esperas.map((e) => e.partner_id));
  const nome = new Map((partners ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Partner"]));

  let alertas = 0;
  for (const e of esperas) {
    const c = conversas.get(e.room_id);
    if (c?.sla_alertado_em && c.sla_alertado_em >= e.desde) continue; // já alertado nesta espera
    await salvarConversa(db, e.room_id, { sla_alertado_em: new Date().toISOString() });
    const horas = Math.floor((Date.now() - Date.parse(e.desde)) / 36e5);
    const texto =
      `⏱️ Chat Partners: ${nome.get(e.partner_id) ?? "Partner"} está há ${horas}h sem resposta\n\n` +
      `"${e.preview}"` +
      (c?.responsavel_nome ? `\nResponsável: ${c.responsavel_nome}` : "\nSem responsável") +
      `\n\nResponder: app.v3partners.com.br/chat/admin?room=${e.room_id}`;
    await enviarWhatsapp(texto).catch(() => {});
    alertas++;
  }
  return alertas;
}

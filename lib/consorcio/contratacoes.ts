// Contratação de cotas novas (quiz em Consórcio › Projetos): regras puras e testáveis.
// BRIEF docs/briefs/2026-11-27_contratar-cota-nova-em-projetos.md
// Sem import de servidor: a tela (client component) usa as mesmas regras e textos.
// A resposta da lista é montada campo a campo a partir de uma lista fechada (teste de paridade):
// WhatsApp e e-mail completos nunca saem por aqui, só pela rota de revelação com log.
import { z } from "zod";
import { normalizePhone, PHONE_ERROR_MSG } from "@/lib/phone";

export type Segmento = "IMOVEL" | "VEICULO" | "PESADO" | "MOTO" | "SERVICO";
export type Quando = "IMEDIATO" | "ATE_12_MESES" | "SEM_PRESSA";
export type StatusContratacao = "NOVA" | "EM_COTACAO" | "PROPOSTA_ENVIADA" | "CONTRATADA" | "NAO_SEGUIU";

export const TETO_CREDITO = 10_000_000;
export const PRAZO_MIN = 6;
export const PRAZO_MAX = 240;

/**
 * Dados da ABAC conferidos na fonte em 27/11/2026 (fixos no código: a ABAC publica em blog/PDF, sem API).
 * Vendas de cotas: https://blog.abac.org.br/drops-de-mercado/sistema-de-consorcios-em-setembro-2026-dados-economicos
 * Taxa média: https://abac.org.br/sistema-downloads/materia-de-marco-de-2026-dados-de-fevereiro-de-2026/
 * Atualizar aqui quando sair boletim novo.
 */
export const ABAC = {
  taxaAdmMedia: 17.5,
  taxaAdmReferencia: "ABAC, matéria de mar/2026 (taxa próxima a 17,5% do crédito, no grupo todo)",
  fundoReservaReferencia: 2,
  vendasPeriodo: "jan–set/2026",
  participantesAtivos: "13,93 milhões em set/2026",
};

export const SEGMENTOS: Record<Segmento, { nome: string; descricao: string; prazos: number[]; vendas: number; vendasRotulo: string }> = {
  IMOVEL: { nome: "Imóvel", descricao: "Casa, apartamento, terreno, construção", prazos: [150, 180, 200, 220], vendas: 37.1, vendasRotulo: "Consórcio de imóveis" },
  VEICULO: { nome: "Veículo leve", descricao: "Carro, utilitário", prazos: [60, 80, 100], vendas: 6.9, vendasRotulo: "Veículos leves" },
  PESADO: { nome: "Veículo pesado", descricao: "Caminhão, máquina, implemento", prazos: [100, 120, 150], vendas: -9.2, vendasRotulo: "Veículos pesados" },
  MOTO: { nome: "Moto", descricao: "Motocicletas", prazos: [50, 60, 80], vendas: 7.3, vendasRotulo: "Motocicletas" },
  SERVICO: { nome: "Serviços", descricao: "Reforma, viagem, estudo, cirurgia", prazos: [30, 40, 50], vendas: 8.5, vendasRotulo: "Serviços" },
};
export const ORDEM_SEGMENTOS: Segmento[] = ["IMOVEL", "VEICULO", "PESADO", "MOTO", "SERVICO"];

export const QUANDO: Record<Quando, string> = {
  IMEDIATO: "O quanto antes",
  ATE_12_MESES: "Em até 12 meses",
  SEM_PRESSA: "Sem pressa, quer investir",
};
export const ORDEM_QUANDO: Quando[] = ["IMEDIATO", "ATE_12_MESES", "SEM_PRESSA"];

export const ORDEM_STATUS: StatusContratacao[] = ["NOVA", "EM_COTACAO", "PROPOSTA_ENVIADA", "CONTRATADA", "NAO_SEGUIU"];
export const ROTULO_STATUS: Record<StatusContratacao, string> = {
  NOVA: "Nova",
  EM_COTACAO: "Em cotação",
  PROPOSTA_ENVIADA: "Proposta enviada",
  CONTRATADA: "Contratada",
  NAO_SEGUIU: "Não seguiu",
};
export function rotuloStatusContratacao(s: string | null | undefined): string {
  return ROTULO_STATUS[(s ?? "") as StatusContratacao] ?? "Nova";
}

const arred2 = (n: number) => Math.round(n * 100) / 100;

/** Parcela de referência: carta × (1 + taxa média ABAC + fundo de reserva) / prazo. Não é proposta. */
export function estimativaParcela(valorCredito: number, prazoMeses: number): number | null {
  if (!(valorCredito > 0) || !(prazoMeses > 0)) return null;
  return arred2((valorCredito * (1 + (ABAC.taxaAdmMedia + ABAC.fundoReservaReferencia) / 100)) / prazoMeses);
}

/** Nome exibido para quem está logado: marca do Enterprise, senão V3 Partners. */
export function nomeExibido(marcaNome: string | null | undefined): string {
  const n = (marcaNome ?? "").trim();
  return n || "V3 Partners";
}

export function textoAutorizacao(marcaNome: string | null | undefined): string {
  return `O cliente autorizou a ${nomeExibido(marcaNome)} a entrar em contato com ele sobre consórcio.`;
}

// ---------- validação (mesmos limites do banco) ----------

const valor = z.number().finite().positive();

export const pedidoSchema = z.object({
  segmento: z.enum(["IMOVEL", "VEICULO", "PESADO", "MOTO", "SERVICO"]),
  valor_credito: valor.max(TETO_CREDITO),
  parcela_maxima: valor,
  prazo_meses: z.number().int().min(PRAZO_MIN).max(PRAZO_MAX),
  tem_lance: z.boolean(),
  lance_valor: z.number().finite().nullable().optional(),
  quando: z.enum(["IMEDIATO", "ATE_12_MESES", "SEM_PRESSA"]),
  cliente_nome: z.string().trim().min(3).max(200),
  cliente_whatsapp: z.string().max(40),
  cliente_email: z.string().trim().max(200).nullable().optional(),
  consentimento: z.literal(true),
});

export type PedidoValido = {
  segmento: Segmento; valor_credito: number; parcela_maxima: number; prazo_meses: number;
  tem_lance: boolean; lance_valor: number | null; quando: Quando;
  cliente_nome: string; cliente_whatsapp: string; cliente_email: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarPedido(body: unknown): { ok: true; dados: PedidoValido } | { ok: false; erro: string } {
  const p = pedidoSchema.safeParse(body);
  if (!p.success) {
    const campo = String(p.error.issues[0]?.path?.[0] ?? "");
    const msgs: Record<string, string> = {
      segmento: "Escolha o segmento.",
      valor_credito: "Informe o valor da carta, até R$ 10.000.000,00.",
      parcela_maxima: "Informe a parcela que cabe no mês.",
      prazo_meses: "Escolha o prazo.",
      tem_lance: "Diga se o cliente tem lance.",
      quando: "Diga quando o cliente quer usar o crédito.",
      cliente_nome: "Informe o nome do cliente (pelo menos 3 letras).",
      consentimento: "Confirme que o cliente autorizou o contato.",
    };
    return { ok: false, erro: msgs[campo] ?? "Confira os dados do pedido." };
  }
  const d = p.data;
  const valorCredito = arred2(d.valor_credito);
  const parcela = arred2(d.parcela_maxima);
  if (parcela > valorCredito) return { ok: false, erro: "A parcela não pode ser maior que o valor da carta." };

  let lance: number | null = null;
  if (d.tem_lance) {
    lance = d.lance_valor == null ? null : arred2(d.lance_valor);
    if (lance == null || !(lance > 0)) return { ok: false, erro: "Informe o valor do lance." };
    if (lance >= valorCredito) return { ok: false, erro: "O lance precisa ser menor que o valor da carta." };
  } else if (d.lance_valor != null) {
    return { ok: false, erro: "Sem lance, o valor do lance fica vazio." };
  }

  const tel = normalizePhone(d.cliente_whatsapp);
  if (!tel.ok || tel.empty || !tel.e164) return { ok: false, erro: PHONE_ERROR_MSG };

  const email = (d.cliente_email ?? "").trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { ok: false, erro: "Confira o e-mail do cliente." };

  return {
    ok: true,
    dados: {
      segmento: d.segmento, valor_credito: valorCredito, parcela_maxima: parcela, prazo_meses: d.prazo_meses,
      tem_lance: d.tem_lance, lance_valor: lance, quando: d.quando,
      cliente_nome: d.cliente_nome.trim(), cliente_whatsapp: tel.e164, cliente_email: email || null,
    },
  };
}

// ---------- acesso ----------

export interface Viewer { id: string; interno: boolean; equipe: string[] }

/** Interno vê tudo; os demais, só os criados por alguém de idsDaEquipe (o próprio id; o master, também a equipe). */
export function podeVerContratacao(viewer: Viewer, linha: { created_by?: string | null }): boolean {
  if (viewer.interno) return true;
  return !!linha.created_by && viewer.equipe.includes(linha.created_by);
}

/** Contato completo: só equipe interna e quem enviou. O master não revela o contato de outro usuário. */
export function podeRevelarContato(viewer: Viewer, linha: { created_by?: string | null }): boolean {
  return viewer.interno || (!!linha.created_by && linha.created_by === viewer.id);
}

/** Decisão da rota de revelação, antes de gravar o log. */
export function decidirRevelacao(
  viewer: Viewer,
  linha: { created_by?: string | null; deleted_at?: string | null } | null,
): 200 | 403 | 404 {
  if (!linha || linha.deleted_at) return 404;
  return podeRevelarContato(viewer, linha) ? 200 : 403;
}

// ---------- máscaras ----------

export function mascararWhatsapp(e164: string | null | undefined): string {
  const d = String(e164 ?? "").replace(/\D/g, "");
  if (d.length < 8) return "Não informado";
  const fim = d.slice(-4);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `+55 (${d.slice(2, 4)}) *****-${fim}`;
  return `+${d.slice(0, Math.max(1, d.length - 8))} ****-${fim}`;
}

export function mascararEmail(email: string | null | undefined): string {
  const e = String(email ?? "").trim();
  const at = e.indexOf("@");
  if (!e || at < 1) return e ? "E-mail informado" : "Não informado";
  return `${e.slice(0, Math.min(2, at))}***${e.slice(at)}`;
}

// ---------- resposta da lista ----------

export const COLUNAS_CONTRATACAO =
  "id, code, segmento, valor_credito, parcela_maxima, prazo_meses, tem_lance, lance_valor, quando, cliente_nome, cliente_whatsapp, cliente_email, status, status_atualizado_em, created_by, created_at";

export const CAMPOS_LISTA = [
  "id", "code", "segmento", "valor_credito", "parcela_maxima", "prazo_meses", "tem_lance", "lance_valor", "quando",
  "cliente_nome", "status", "created_at", "enviado_por", "origem", "pode_revelar", "whatsapp_mascarado", "email_mascarado",
  "comentarios",
] as const;

type Linha = Record<string, unknown>;
const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function contratacaoParaLista(o: Linha, viewer: Viewer, extras: { enviadoPor: string; origem: string | null; comentarios?: number }) {
  const pode = podeRevelarContato(viewer, o as { created_by?: string | null });
  return {
    id: String(o.id),
    code: String(o.code ?? ""),
    segmento: String(o.segmento ?? ""),
    valor_credito: num(o.valor_credito),
    parcela_maxima: num(o.parcela_maxima),
    prazo_meses: num(o.prazo_meses),
    tem_lance: o.tem_lance === true,
    lance_valor: num(o.lance_valor),
    quando: String(o.quando ?? ""),
    cliente_nome: String(o.cliente_nome ?? ""),
    status: String(o.status ?? "NOVA"),
    created_at: (o.created_at as string | null) ?? null,
    enviado_por: extras.enviadoPor,
    origem: viewer.interno ? extras.origem : null,
    pode_revelar: pode,
    whatsapp_mascarado: pode ? mascararWhatsapp(o.cliente_whatsapp as string | null) : null,
    email_mascarado: pode ? mascararEmail(o.cliente_email as string | null) : null,
    comentarios: extras.comentarios ?? 0,
  };
}

export type ContratacaoLista = ReturnType<typeof contratacaoParaLista>;

/** Grupos na ordem da escala; dentro do grupo, mais recente primeiro. */
export function ordenarContratacoes<T extends { status: string; created_at: string | null }>(lista: T[]): T[] {
  const pos = (s: string) => { const i = ORDEM_STATUS.indexOf(s as StatusContratacao); return i < 0 ? ORDEM_STATUS.length : i; };
  return [...lista].sort((a, b) => pos(a.status) - pos(b.status) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}

export function ehStatusValido(s: unknown): s is StatusContratacao {
  return typeof s === "string" && (ORDEM_STATUS as string[]).includes(s);
}

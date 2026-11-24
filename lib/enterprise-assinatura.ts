// Cobrança do master Enterprise aos usuários da equipe (BRIEF docs/briefs/2026-11-23_enterprise-assinatura-da-equipe.md).
// Só registro: a V3 não recebe. Datas sempre como texto "AAAA-MM-DD" (sem new Date("AAAA-MM-DD"), que é UTC);
// "hoje" calculado em America/Sao_Paulo.

export type Periodicidade = "MENSAL" | "TRIMESTRAL" | "ANUAL";
export const PERIODICIDADES: Periodicidade[] = ["MENSAL", "TRIMESTRAL", "ANUAL"];
export const MESES_DO_PERIODO: Record<Periodicidade, number> = { MENSAL: 1, TRIMESTRAL: 3, ANUAL: 12 };
export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = { MENSAL: "Mensal", TRIMESTRAL: "Trimestral", ANUAL: "Anual" };
export const VALOR_MAXIMO = 1_000_000;

export interface AssinaturaEquipe {
  cobra: boolean;
  valor: number;
  periodicidade: Periodicidade;
  dia_vencimento: number;
  inicio: string;
  /** Último vencimento quitado (null = nenhum). */
  pago_ate: string | null;
}

export type Situacao =
  | { tipo: "SEM_COBRANCA" }
  | { tipo: "EM_DIA"; vencimento: string }
  | { tipo: "VENCIDA"; vencimento: string };

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "AAAA-MM-DD" válido (ano 2000 a 2100, dia existe no mês). */
export function dataValida(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = RE_DATA.exec(s);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (a < 2000 || a > 2100 || mes < 1 || mes > 12 || d < 1) return false;
  return d <= diasNoMes(a, mes);
}

function diasNoMes(ano: number, mes: number): number {
  return [31, ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

const partes = (s: string) => { const m = RE_DATA.exec(s)!; return { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }; };
const fmt = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Soma meses mantendo o dia (dia de vencimento vai até 28, então sempre existe). */
export function somarMeses(data: string, meses: number): string {
  const { a, m, d } = partes(data);
  const total = a * 12 + (m - 1) + meses;
  return fmt(Math.floor(total / 12), (total % 12) + 1, d);
}

/** Hoje em America/Sao_Paulo, "AAAA-MM-DD". */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** "AAAA-MM-DD" → "DD/MM/AAAA". */
export function dataBr(s: string): string {
  const { a, m, d } = partes(s);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

/** "DD/MM/AAAA" → "AAAA-MM-DD" (por componentes) ou null. */
export function dataDoBr(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return dataValida(iso) ? iso : null;
}

/** D0: primeira data com o dia de vencimento igual ou posterior ao início. */
export function primeiroVencimento(r: Pick<AssinaturaEquipe, "inicio" | "dia_vencimento">): string {
  const { a, m, d } = partes(r.inicio);
  return d <= r.dia_vencimento ? fmt(a, m, r.dia_vencimento) : somarMeses(fmt(a, m, r.dia_vencimento), 1);
}

/** Vencimento em aberto: D0 se nada pago; senão pago_ate + 1 período. */
export function vencimentoEmAberto(r: AssinaturaEquipe): string {
  return r.pago_ate ? somarMeses(r.pago_ate, MESES_DO_PERIODO[r.periodicidade]) : primeiroVencimento(r);
}

/** Vencimento anterior ao pago_ate (para desfazer); null se pago_ate é o primeiro. */
export function vencimentoAnterior(r: AssinaturaEquipe): string | null {
  if (!r.pago_ate) return null;
  if (r.pago_ate <= primeiroVencimento(r)) return null;
  return somarMeses(r.pago_ate, -MESES_DO_PERIODO[r.periodicidade]);
}

export function situacaoAssinatura(r: AssinaturaEquipe | null | undefined, hoje: string): Situacao {
  if (!r || !r.cobra) return { tipo: "SEM_COBRANCA" };
  const v = vencimentoEmAberto(r);
  return hoje <= v ? { tipo: "EM_DIA", vencimento: v } : { tipo: "VENCIDA", vencimento: v };
}

export function rotuloSituacao(s: Situacao): string {
  if (s.tipo === "SEM_COBRANCA") return "Sem cobrança";
  return s.tipo === "EM_DIA" ? `Em dia (próximo vencimento ${dataBr(s.vencimento)})` : `Vencida desde ${dataBr(s.vencimento)}`;
}

/** Lê o jsonb do banco com tolerância: formato inválido vira null ("sem cobrança"). */
export function lerAssinatura(v: unknown): AssinaturaEquipe | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const periodicidade = PERIODICIDADES.includes(o.periodicidade as Periodicidade) ? (o.periodicidade as Periodicidade) : null;
  const dia = Number(o.dia_vencimento);
  if (!periodicidade || !Number.isInteger(dia) || dia < 1 || dia > 28 || !dataValida(o.inicio)) return null;
  return {
    cobra: o.cobra === true,
    valor: Math.round(Number(o.valor ?? 0) * 100) / 100,
    periodicidade,
    dia_vencimento: dia,
    inicio: o.inicio,
    pago_ate: dataValida(o.pago_ate) ? o.pago_ate : null,
  };
}

/** Valor em reais: aceita número ou texto pt-BR ("1.234,56"). null se inválido. */
export function lerValor(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.replace(/[R$\s]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// MY ASSISTANT IA: regras puras de valor, data e exibição, usadas na tela, na API e no webhook.
// BRIEF: docs/briefs/2026-11-01_my-assistant-ia.md

export const VALOR_MIN_CENTAVOS = 1;
export const VALOR_MAX_CENTAVOS = 1_000_000_000;
const FUSO = "America/Sao_Paulo";

const CATEGORIAS_BASE = [
  "Alimentação", "Mercado", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Viagem",
  "Vestuário", "Impostos", "Serviços", "Assinaturas", "Salário", "Pró-labore", "Investimentos", "Presentes",
];
// "Outros" fica sempre por último, por ser o valor residual.
export const CATEGORIAS = [...CATEGORIAS_BASE.sort((a, b) => a.localeCompare(b, "pt-BR")), "Outros"];

export function valorValido(centavos: unknown): centavos is number {
  return Number.isInteger(centavos) && (centavos as number) >= VALOR_MIN_CENTAVOS && (centavos as number) <= VALOR_MAX_CENTAVOS;
}

/** "1.500,00" vira 150000. Conta só dígitos, sem passar por ponto flutuante. */
export function centavosDaMascara(mascara: string): number {
  const digitos = mascara.replace(/\D/g, "");
  return digitos ? parseInt(digitos, 10) : 0;
}

export function mascaraDeCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : "";
  return `${sinal}R$ ${mascaraDeCentavos(Math.abs(centavos))}`;
}

function dataExiste(ano: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function dataIsoValida(iso: unknown): iso is string {
  if (typeof iso !== "string") return false;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return !!m && dataExiste(+m[1], +m[2], +m[3]);
}

/** Sem new Date("AAAA-MM-DD"), para não deslocar o dia pelo fuso. */
export function dataIsoParaBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function dataBrParaIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return dataIsoValida(iso) ? iso : null;
}

export function mascaraDataBr(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function mascaraHora(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

function partesBrasilia(instante: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instante);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

export function hojeBrasilia(agora: Date = new Date()): string {
  return partesBrasilia(agora).data;
}

export function agoraBrasilia(agora: Date = new Date()): string {
  const p = partesBrasilia(agora);
  return `${p.data}T${p.hora}`;
}

export function dataHoraBr(instante: string | Date): string {
  const p = partesBrasilia(new Date(instante));
  return `${dataIsoParaBr(p.data)} ${p.hora}`;
}

export function partesDataHoraBr(instante: string): { data: string; hora: string } {
  const p = partesBrasilia(new Date(instante));
  return { data: dataIsoParaBr(p.data), hora: p.hora };
}

/** "AAAA-MM-DDTHH:mm" em Brasília (UTC-3, sem horário de verão vigente) vira timestamp com fuso. */
export function localBrasiliaParaIso(local: unknown): string | null {
  if (typeof local !== "string") return null;
  const m = local.match(/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m || !dataIsoValida(m[1])) return null;
  return `${m[1]}T${m[2]}:${m[3]}:00-03:00`;
}

export function mesValido(mes: unknown): mes is string {
  return typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

/** Primeiro dia do mês e primeiro dia do mês seguinte. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number);
  const proximo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01`, fim: `${proximo}-01` };
}

/** Mais recente primeiro. */
export function mesesRecentes(quantidade: number, agora: Date = new Date()): string[] {
  const [a, m] = hojeBrasilia(agora).split("-").map(Number);
  return Array.from({ length: quantidade }, (_, i) => {
    const total = a * 12 + (m - 1) - i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

export function rotuloMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${m}/${a}`;
}

export function telefoneOculto(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+55 (${d.slice(2, 4)}) *****-${d.slice(-4)}`;
  return `+${d.slice(0, Math.max(1, d.length - 10))} ******${d.slice(-4)}`;
}

/** Sem travessão e sem emoji, inclusive em texto que a pessoa ditou e volta na resposta. */
export function textoLimpo(texto: string): string {
  return texto.replace(/[—–]/g, ",").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

// Lembrete de pagamento do Contrato de Parceria (21/10/2026, pedido do
// Hamilton): 2 dias antes da "Data prevista de pagamento" que o ADMIN digitou
// no "Enviar contrato" (item 3.1 do contrato), manda um aviso no WhatsApp da
// V3. Não precisa de coluna nova: a data é lida do próprio contrato gerado
// (operation_contracts.rendered_html), e o envio fica registrado como nota
// do contrato na Central (contract_notes), que também evita aviso repetido.

export const LEMBRETE_PAGAMENTO_WHATSAPP = "51997466001";
export const LEMBRETE_PAGAMENTO_DIAS_ANTES = 2;
export const LEMBRETE_PAGAMENTO_NOTA = "Lembrete de pagamento enviado";

/** "Data prevista de pagamento: 25/10/2026" no contrato → "2026-10-25". */
export function dataPagamentoDoContrato(html: string | null | undefined): string | null {
  const m = (html ?? "").match(/Data prevista de pagamento:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Plano e anuidade impressos no item 3.1. */
export function planoDoContrato(html: string | null | undefined): { plano: string; anuidade: string } | null {
  const m = (html ?? "").match(/Plano contratado:\s*([^,<]+),\s*anuidade de\s*(R\$\s*[\d.,]+)/);
  return m ? { plano: m[1].trim(), anuidade: m[2].trim() } : null;
}

/** Data de hoje no fuso de Brasília, "yyyy-mm-dd". */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function diasEntre(deIso: string, ateIso: string): number {
  return Math.round((Date.parse(`${ateIso}T00:00:00Z`) - Date.parse(`${deIso}T00:00:00Z`)) / 86400000);
}

/**
 * Lembrete devido quando faltam de 0 a 2 dias para a data. A janela (e não
 * "exatamente 2 dias") cobre contrato enviado com data muito próxima e dia em
 * que o cron não rodou; a nota no contrato garante um aviso só.
 */
export function lembreteDevido(dataPagamento: string, hoje: string): boolean {
  const d = diasEntre(hoje, dataPagamento);
  return d >= 0 && d <= LEMBRETE_PAGAMENTO_DIAS_ANTES;
}

export function dataBRdeIso(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const STATUS_CONTRATO: Record<string, string> = {
  rascunho: "rascunho, não enviado",
  enviado: "aguardando assinatura",
  assinado: "assinado",
};

export function mensagemLembrete(p: {
  nome: string;
  dataPagamento: string;
  hoje: string;
  plano: { plano: string; anuidade: string } | null;
  contractCode: string | null;
  statusContrato: string;
  telefone?: string | null;
  email?: string | null;
}): string {
  const dias = diasEntre(p.hoje, p.dataPagamento);
  const quando = dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
  return (
    `💰 Lembrete: pagamento do partner ${quando}\n\n` +
    `${p.nome}\n` +
    `📅 Data prevista: ${dataBRdeIso(p.dataPagamento)}` +
    (p.plano ? `\n📋 ${p.plano.plano}, anuidade de ${p.plano.anuidade}` : "") +
    `\n📝 Contrato ${p.contractCode ?? "sem número"} (${STATUS_CONTRATO[p.statusContrato] ?? p.statusContrato})` +
    (p.telefone ? `\n📱 ${p.telefone}` : "") +
    (p.email ? `\n✉️ ${p.email}` : "") +
    `\n\nVer: app.v3partners.com.br/admin-cadastros`
  );
}

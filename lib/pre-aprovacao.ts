// Pré-aprovação da proposta (BRIEF 2026-11-03_pre-aprovacao-mesa-operacional.md). A Mesa preenche à
// mão; a rota grava em metadata.pre_aprovacao e envia o e-mail ao cliente e ao partner. Pelo parecer do
// Robson de 03/11/2026, o e-mail ao cliente vale como a comunicação escrita da Cláusula 4-A do mandato,
// não traz o nome da instituição, e o do partner vai sem as rendas do cliente.
import { valorEmReaisPorExtenso } from "@/lib/utils/valor-extenso";

export const TETO_RENDA = 10_000_000;
export const TETO_VALOR = 1_000_000_000;

/** Nome do campo renda_aprovada. Registros sem rotulo_renda foram enviados com o nome antigo
 * (BRIEF 2026-11-04_pre-aprovacao-renda-necessaria.md) e continuam mostrando esse nome. */
export const ROTULO_RENDA_NECESSARIA = "Renda média necessária para o crédito pretendido";
export const ROTULO_RENDA_ANTIGO = "Renda média aprovada pela instituição";

export function rotuloRenda(registro: { rotulo_renda?: string } | null | undefined): string {
  return registro?.rotulo_renda === "necessaria" ? ROTULO_RENDA_NECESSARIA : ROTULO_RENDA_ANTIGO;
}

export type ProximaEtapa = { avaliacao: boolean; contrato: boolean; outros: boolean; outros_texto: string | null };

export type PreAprovacaoDados = {
  renda_apresentada: number;
  renda_aprovada: number;
  valor_pre_aprovado: number;
  valor_imovel: number;
  valor_pretendido: number;
  proxima_etapa: ProximaEtapa;
  /** Todo envio novo grava "necessaria"; ausente = registro enviado com o nome antigo. */
  rotulo_renda?: "necessaria";
};

export type PreAprovacaoRegistro = PreAprovacaoDados & {
  enviado_em: string;
  enviado_por: string;
  enviado_por_nome: string | null;
  emails: { cliente: string | null; partner: string | null };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(v: unknown): v is string {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

function valor(v: unknown, teto: number, nome: string): number | string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return `${nome}: informe um valor maior que zero.`;
  if (n > teto) return `${nome}: valor acima do limite permitido.`;
  return Math.round(n * 100) / 100;
}

/** Valida o corpo recebido; devolve os dados normalizados ou a lista de erros. */
export function validarPreAprovacao(body: Record<string, unknown>): { ok: true; dados: PreAprovacaoDados } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  const campos = {
    renda_apresentada: valor(body.renda_apresentada, TETO_RENDA, "Renda média apresentada"),
    renda_aprovada: valor(body.renda_aprovada, TETO_RENDA, ROTULO_RENDA_NECESSARIA),
    valor_pre_aprovado: valor(body.valor_pre_aprovado, TETO_VALOR, "Valor pré-aprovado"),
    valor_imovel: valor(body.valor_imovel, TETO_VALOR, "Valor do imóvel"),
    valor_pretendido: valor(body.valor_pretendido, TETO_VALOR, "Valor pretendido"),
  };
  for (const v of Object.values(campos)) if (typeof v === "string") erros.push(v);
  const pe = (body.proxima_etapa ?? {}) as Record<string, unknown>;
  const proxima: ProximaEtapa = {
    avaliacao: pe.avaliacao === true,
    contrato: pe.contrato === true,
    outros: pe.outros === true,
    outros_texto: typeof pe.outros_texto === "string" && pe.outros_texto.trim() ? pe.outros_texto.trim().slice(0, 300) : null,
  };
  if (!proxima.avaliacao && !proxima.contrato && !proxima.outros) erros.push("Marque ao menos uma próxima etapa.");
  if (proxima.outros && !proxima.outros_texto) erros.push("Informe qual é a próxima etapa em Outros.");
  if (!proxima.outros) proxima.outros_texto = null;
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: { ...(campos as Omit<PreAprovacaoDados, "proxima_etapa">), proxima_etapa: proxima, rotulo_renda: "necessaria" } };
}

/** Avisos que não bloqueiam o envio. */
export function avisosPreAprovacao(d: Pick<PreAprovacaoDados, "valor_pre_aprovado" | "valor_imovel" | "valor_pretendido">): string[] {
  const a: string[] = [];
  if (d.valor_pre_aprovado > d.valor_pretendido) a.push("O valor pré-aprovado é maior que o valor pretendido.");
  if (d.valor_pre_aprovado > d.valor_imovel) a.push("O valor pré-aprovado é maior que o valor do imóvel.");
  return a;
}

export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
}

export function proximaEtapaTexto(pe: ProximaEtapa): string[] {
  const l: string[] = [];
  if (pe.avaliacao) l.push("Avaliação do imóvel");
  if (pe.contrato) l.push("Assinatura do contrato");
  if (pe.outros && pe.outros_texto) l.push(pe.outros_texto);
  return l;
}

export function mascararEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Assunto e HTML do e-mail. O do partner não leva as rendas do cliente. */
export function montarEmailPreAprovacao(p: {
  destinatario: "cliente" | "partner";
  nome: string | null;
  codigo: string;
  clienteNome: string | null;
  dados: PreAprovacaoDados;
  enviadoEm: string;
}): { subject: string; html: string } {
  const { dados: d } = p;
  const subject = `Pré-aprovação da sua operação ${p.codigo}`;
  const linhas: [string, string][] = [];
  if (p.destinatario === "cliente") {
    linhas.push(["Renda média apresentada", brl(d.renda_apresentada)]);
    linhas.push([ROTULO_RENDA_NECESSARIA, brl(d.renda_aprovada)]);
  }
  linhas.push(["Valor pré-aprovado", `${brl(d.valor_pre_aprovado)} (${valorEmReaisPorExtenso(d.valor_pre_aprovado)})`]);
  linhas.push(["Valor do imóvel", brl(d.valor_imovel)]);
  linhas.push(["Valor pretendido", brl(d.valor_pretendido)]);
  const etapas = proximaEtapaTexto(d.proxima_etapa);
  const saudacao = p.nome ? `Olá, ${esc(p.nome.split(" ")[0])}.` : "Olá.";
  const abertura = p.destinatario === "cliente"
    ? `A sua operação <strong>${esc(p.codigo)}</strong> foi pré-aprovada. Seguem os valores:`
    : `A operação <strong>${esc(p.codigo)}</strong>${p.clienteNome ? ` do cliente ${esc(p.clienteNome)}` : ""}, originada por você, foi pré-aprovada. Seguem os valores:`;
  const html = `<div style="font-family:Arial,sans-serif;color:#111F35;font-size:14px;line-height:1.5">
<p>${saudacao}</p>
<p>${abertura}</p>
<table style="border-collapse:collapse">${linhas.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7A8FA8">${k}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`).join("")}</table>
<p><strong>Próxima etapa:</strong> ${etapas.map(esc).join("; ")}.</p>
<p>Valores sujeitos à avaliação do imóvel e à análise final da instituição.</p>
<p style="color:#7A8FA8;font-size:12px">Comunicação de pré-aprovação enviada em ${dataHoraBR(p.enviadoEm)} (horário de Brasília).</p>
<p>V3 Partners</p>
</div>`;
  return { subject, html };
}

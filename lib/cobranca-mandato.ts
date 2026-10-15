import type { SupabaseClient } from "@supabase/supabase-js";
import { MANDATO_SERIES, percentualPorExtenso, enviosDoMandato } from "@/lib/mandato-credito";

// Cobrança da Remuneração de Sucesso (15/10/2026, pedido do Hamilton): a Mesa
// Operacional lança no modal da proposta cada recurso liberado (tranche) e gera,
// a partir do Mandato de Crédito assinado, um PDF para o cliente pagar a
// comissão da V3. Valor = % do mandato (cl. 3.1) × valor liberado; vencimento
// em 2 dias úteis da liberação (cl. 3.3); tranches cobradas uma a uma (cl. 3.6).

/** Conta da cláusula 3.3 das minutas de Mandato (PF e PJ). */
export const CONTA_MANDATO = {
  favorecido: "V3 Partners Soluções Ltda",
  cnpj: "14.219.287/0001-50",
  pix: "14.219.287/0001-50 (CNPJ)",
  banco: "403 – Cora SCD",
  agencia: "0001",
  conta: "7175979-1",
} as const;

export const PRAZO_DIAS_UTEIS = 2;

export type RecursoLiberado = {
  id: string;
  valor: number;
  /** aaaa-mm-dd — Data da Concretização da tranche. */
  data: string;
  instituicao?: string;
  obs?: string;
  criado_em: string;
  criado_por?: string;
  /** Preenchido quando o PDF de cobrança é gerado pela primeira vez. */
  cobranca_gerada_em?: string;
};

export function recursosLiberados(metadata: Record<string, unknown> | null | undefined): RecursoLiberado[] {
  const lista = metadata?.recursos_liberados;
  if (!Array.isArray(lista)) return [];
  return lista.filter((r): r is RecursoLiberado =>
    !!r && typeof r === "object" && typeof (r as RecursoLiberado).id === "string"
    && Number.isFinite(Number((r as RecursoLiberado).valor)));
}

// ── Dias úteis ─────────────────────────────────────────────────────────────

// Feriados nacionais fixos; os móveis (Carnaval, Sexta Santa, Corpus Christi) ficam de fora.
const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

function ehDiaUtil(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const md = d.toISOString().slice(5, 10);
  return !FERIADOS_FIXOS.includes(md);
}

/** aaaa-mm-dd + n dias úteis → aaaa-mm-dd. */
export function somarDiasUteis(dataISO: string, n: number): string {
  const d = new Date(`${dataISO.slice(0, 10)}T12:00:00Z`);
  let faltam = n;
  while (faltam > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (ehDiaUtil(d)) faltam--;
  }
  return d.toISOString().slice(0, 10);
}

export function dataBR(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// ── Mandato assinado ───────────────────────────────────────────────────────

export type MandatoAssinado = {
  contract_id: string;
  contract_code: string;
  signed_at: string | null;
  percentual: number;
  contratante_nome: string;
  contratante_doc: string;
};

type ContratoRow = {
  id: string;
  contract_code: string | null;
  signed_at: string | null;
  rendered_html: string | null;
};

type PropostaRow = {
  client_name?: string | null;
  client_cpf_cnpj?: string | null;
  comissao_mandato_perc?: number | null;
  metadata?: Record<string, unknown> | null;
};

function textoPlano(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** % da cláusula 3.1 como ficou no contrato assinado ("3% (três por cento)" → 3). */
export function percentualDoContrato(html: string | null | undefined): number | null {
  const m = textoPlano(html ?? "").match(/Remunera[çc][ãa]o de Sucesso equivalente a ([\d.,]+)\s*%/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Nome e CPF/CNPJ da CONTRATANTE, lidos do parágrafo de qualificação do contrato assinado. */
export function contratanteDoContrato(html: string | null | undefined): { nome: string; doc: string } | null {
  const s = html ?? "";
  const i = s.indexOf("de outro lado");
  if (i < 0) return null;
  const p = s.slice(i).match(/<p[^>]*>([\s\S]*?)<\/p>/g)?.find((x) => /CONTRATANTE/.test(x));
  if (!p) return null;
  const nome = p.match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim() ?? "";
  const doc = p.match(/(?:CNPJ|CPF) sob o n[ºo°]\s*([\d./-]+)/)?.[1]?.replace(/[.,]$/, "") ?? "";
  return nome ? { nome, doc } : null;
}

/** Mandato de Crédito assinado mais recente da proposta, ou null. */
export async function mandatoAssinadoDaProposta(
  db: SupabaseClient,
  proposalId: string,
  proposta: PropostaRow,
): Promise<MandatoAssinado | null> {
  const { data } = await db
    .from("operation_contracts")
    .select("id, contract_code, signed_at, rendered_html")
    .eq("credit_proposal_id", proposalId)
    .eq("status_signature", "assinado")
    .like("contract_code", `${MANDATO_SERIES}-%`)
    .is("deleted_at", null)
    .order("signed_at", { ascending: false, nullsFirst: false })
    .limit(1);
  const c = (data?.[0] ?? null) as ContratoRow | null;
  if (!c?.contract_code) return null;

  const envio = enviosDoMandato(proposta.metadata).find((e) => e.contract_id === c.id);
  const percentual = percentualDoContrato(c.rendered_html)
    ?? (typeof envio?.percentual === "number" ? envio.percentual : null)
    ?? Number(proposta.comissao_mandato_perc ?? 0);
  const contratante = contratanteDoContrato(c.rendered_html);

  return {
    contract_id: c.id,
    contract_code: c.contract_code,
    signed_at: c.signed_at,
    percentual,
    contratante_nome: contratante?.nome ?? (proposta.client_name ?? "").toUpperCase(),
    contratante_doc: contratante?.doc ?? proposta.client_cpf_cnpj ?? "",
  };
}

// ── Cálculo e PDF ──────────────────────────────────────────────────────────

export function calcularCobranca(m: MandatoAssinado, r: RecursoLiberado) {
  const remuneracao = Math.round(r.valor * m.percentual) / 100;
  return { remuneracao, vencimento: somarDiasUteis(r.data, PRAZO_DIAS_UTEIS) };
}

/** Código do demonstrativo: mandato + nº da tranche (ordem de lançamento). */
export function codigoCobranca(m: MandatoAssinado, recursos: RecursoLiberado[], r: RecursoLiberado): string {
  const n = recursos.findIndex((x) => x.id === r.id) + 1;
  return `${m.contract_code.replace(MANDATO_SERIES, "V3C-COB")}-T${n || 1}`;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function htmlCobranca(opts: {
  mandato: MandatoAssinado;
  recurso: RecursoLiberado;
  codigo: string;
  propostaCode?: string | null;
  emitidoEm: Date;
}): string {
  const { mandato: m, recurso: r, codigo } = opts;
  const { remuneracao, vencimento } = calcularCobranca(m, r);
  const emitido = opts.emitidoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const assinado = m.signed_at
    ? new Date(m.signed_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
  const linha = (rotulo: string, valor: string, forte = false) =>
    `<tr><td class="r">${rotulo}</td><td class="v${forte ? " f" : ""}">${valor}</td></tr>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DM Sans", Arial, sans-serif; color: #111F35; font-size: 12px; }
  .pg { padding: 44px 52px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #C9A84C; padding-bottom: 16px; }
  .top .cod { text-align: right; font-size: 11px; color: #4A5A70; line-height: 1.6; }
  .top .cod b { color: #111F35; font-size: 13px; }
  h1 { font-size: 19px; margin: 26px 0 4px; letter-spacing: .2px; }
  .sub { color: #4A5A70; margin: 0 0 20px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #A88A35; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 10px; border-bottom: 1px solid #E5E1D8; vertical-align: top; }
  td.r { color: #4A5A70; width: 42%; }
  td.v { font-weight: 500; }
  td.f { font-weight: 700; }
  .total { margin-top: 20px; display: flex; justify-content: space-between; align-items: center; background: #111F35; color: #F0ECE4; border-radius: 10px; padding: 16px 20px; }
  .total .l { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #E8C97A; }
  .total .n { font-size: 24px; font-weight: 700; }
  .total .venc { text-align: right; font-size: 11px; color: #C9D2DE; }
  .total .venc b { display: block; font-size: 15px; color: #F0ECE4; }
  .pix { margin-top: 16px; border: 1px solid #C9A84C; border-radius: 10px; padding: 14px 18px; background: #FBF8F0; }
  .pix p { margin: 3px 0; }
  .pix .k { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
  .nota { margin-top: 22px; font-size: 10.5px; color: #4A5A70; line-height: 1.55; }
  .nota p { margin: 0 0 6px; }
  .rod { margin-top: 30px; padding-top: 10px; border-top: 1px solid #E5E1D8; font-size: 9.5px; color: #7A8FA8; display: flex; justify-content: space-between; }
</style></head><body><div class="pg">
  <div class="top">
    <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:56px">
    <div class="cod">Demonstrativo nº <b>${esc(codigo)}</b><br>Emitido em ${emitido}${opts.propostaCode ? `<br>Proposta ${esc(opts.propostaCode)}` : ""}</div>
  </div>

  <h1>Remuneração de Sucesso – Recurso Liberado</h1>
  <p class="sub">Cobrança referente ao Mandato de Crédito nº <b>${esc(m.contract_code)}</b>, assinado em ${assinado}.</p>

  <h2>Partes</h2>
  <table>
    ${linha("Contratante", esc(m.contratante_nome), true)}
    ${m.contratante_doc ? linha(m.contratante_doc.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF", esc(m.contratante_doc)) : ""}
    ${linha("Contratada", `${CONTA_MANDATO.favorecido} – CNPJ ${CONTA_MANDATO.cnpj}`)}
  </table>

  <h2>Recurso liberado</h2>
  <table>
    ${linha("Data da liberação (Data da Concretização)", dataBR(r.data))}
    ${r.instituicao ? linha("Instituição", esc(r.instituicao)) : ""}
    ${linha("Valor da Operação liberado", brl(r.valor), true)}
    ${linha("Remuneração de Sucesso (cláusula 3.1)", esc(percentualPorExtenso(m.percentual)) + " do Valor da Operação")}
    ${r.obs ? linha("Observação", esc(r.obs)) : ""}
  </table>

  <div class="total">
    <div><div class="l">Valor a pagar</div><div class="n">${brl(remuneracao)}</div></div>
    <div class="venc">Vencimento<b>${dataBR(vencimento)}</b>${PRAZO_DIAS_UTEIS} dias úteis da liberação</div>
  </div>

  <h2>Dados para pagamento</h2>
  <div class="pix">
    <p>PIX (chave CNPJ)</p>
    <p class="k">${CONTA_MANDATO.cnpj}</p>
    <p style="margin-top:8px">Banco ${CONTA_MANDATO.banco} · Agência ${CONTA_MANDATO.agencia} · Conta ${CONTA_MANDATO.conta}</p>
    <p>Favorecido: <b>${CONTA_MANDATO.favorecido}</b> – CNPJ ${CONTA_MANDATO.cnpj}</p>
  </div>

  <div class="nota">
    <p>Pagamento por PIX ou transferência para a conta acima, de titularidade da CONTRATADA, conforme a cláusula 3.3 do Mandato; o comprovante serve como recibo. A nota fiscal correspondente será emitida em até 1 (um) dia útil.</p>
    <p>Em liberações parceladas, a Remuneração de Sucesso é devida sobre cada parcela (cláusula 3.6). Se a Instituição já tiver retido e repassado este valor diretamente à V3 (cláusula 3.5), desconsidere esta cobrança.</p>
    <p>O atraso sujeita o débito aos encargos da cláusula 3.10 do Mandato.</p>
  </div>

  <div class="rod"><span>V3 Partners Soluções Ltda · CNPJ ${CONTA_MANDATO.cnpj}</span><span>${esc(codigo)}</span></div>
</div></body></html>`;
}

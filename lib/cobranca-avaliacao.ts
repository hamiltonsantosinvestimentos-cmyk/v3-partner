// Cobrança da avaliação de engenharia (19/10/2026, pedido do Hamilton): quando a proposta
// chega na etapa Avaliação de Imóvel, a Mesa Operacional informa o valor do laudo da empresa
// de engenharia e gera um PDF para o cliente pagar por PIX na conta da V3 (Cora — a mesma da
// cobrança do mandato). Lista em credit_desk_proposals.metadata.cobrancas_avaliacao (só o
// servidor grava; ver protegerMetadata).

import { CONTA_MANDATO, dataBR } from "./cobranca-mandato";

export type CobrancaAvaliacao = {
  id: string;
  /** V3-AVL-<código da proposta>-<n> */
  codigo: string;
  valor: number;
  /** aaaa-mm-dd */
  vencimento: string;
  descricao: string;
  /** Imóvel(is) a avaliar (endereço/matrícula), impresso no PDF. */
  imovel?: string | null;
  criado_em: string;
  criado_por?: string | null;
  pago_em?: string | null;
  pago_por?: string | null;
};

export const DESCRICAO_PADRAO = "Laudo de avaliação do imóvel em garantia, elaborado por empresa de engenharia credenciada, exigido pela instituição financeira para a análise do crédito";

export function cobrancasAvaliacao(metadata: Record<string, unknown> | null | undefined): CobrancaAvaliacao[] {
  const lista = (metadata ?? {}).cobrancas_avaliacao;
  return Array.isArray(lista) ? (lista as CobrancaAvaliacao[]).filter((c) => c && typeof c.id === "string" && c.valor > 0) : [];
}

export function codigoCobrancaAvaliacao(propostaCode: string | null | undefined, existentes: CobrancaAvaliacao[]): string {
  const base = (propostaCode ?? "PROPOSTA").replace(/[^A-Za-z0-9-]/g, "");
  return `V3-AVL-${base}-${existentes.length + 1}`;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmtDoc(doc: string | null | undefined): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc ?? "";
}

export function htmlCobrancaAvaliacao(opts: {
  cobranca: CobrancaAvaliacao;
  clienteNome: string;
  clienteDoc?: string | null;
  propostaCode?: string | null;
  emitidoEm: Date;
}): string {
  const { cobranca: c } = opts;
  const emitido = opts.emitidoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const doc = fmtDoc(opts.clienteDoc);
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
  td.r { color: #4A5A70; width: 38%; }
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
    <div class="cod">Cobrança nº <b>${esc(c.codigo)}</b><br>Emitida em ${emitido}${opts.propostaCode ? `<br>Proposta ${esc(opts.propostaCode)}` : ""}</div>
  </div>

  <h1>Avaliação do Imóvel – Laudo de Engenharia</h1>
  <p class="sub">Valor para a contratação do laudo de avaliação do imóvel oferecido em garantia.</p>

  <h2>Cliente</h2>
  <table>
    ${linha("Nome", esc(opts.clienteNome), true)}
    ${doc ? linha(doc.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF", esc(doc)) : ""}
  </table>

  <h2>Serviço</h2>
  <table>
    ${linha("Descrição", esc(c.descricao))}
    ${c.imovel ? linha("Imóvel", esc(c.imovel)) : ""}
    ${linha("Valor", brl(c.valor), true)}
  </table>

  <div class="total">
    <div><div class="l">Valor a pagar</div><div class="n">${brl(c.valor)}</div></div>
    <div class="venc">Vencimento<b>${dataBR(c.vencimento)}</b></div>
  </div>

  <h2>Dados para pagamento</h2>
  <div class="pix">
    <p>PIX (chave CNPJ)</p>
    <p class="k">${CONTA_MANDATO.cnpj}</p>
    <p style="margin-top:8px">Banco ${CONTA_MANDATO.banco} · Agência ${CONTA_MANDATO.agencia} · Conta ${CONTA_MANDATO.conta}</p>
    <p>Favorecido: <b>${CONTA_MANDATO.favorecido}</b> – CNPJ ${CONTA_MANDATO.cnpj}</p>
  </div>

  <div class="nota">
    <p>Pagamento por PIX ou transferência para a conta acima, de titularidade da V3 Partners; o comprovante serve como recibo. Envie o comprovante ao seu assessor para que a vistoria do imóvel seja agendada com a empresa de engenharia.</p>
    <p>O valor refere-se exclusivamente ao serviço de avaliação do imóvel pela empresa de engenharia, exigido pela instituição financeira na análise do crédito.</p>
  </div>

  <div class="rod"><span>V3 Partners Soluções Ltda · CNPJ ${CONTA_MANDATO.cnpj}</span><span>${esc(c.codigo)}</span></div>
</div></body></html>`;
}

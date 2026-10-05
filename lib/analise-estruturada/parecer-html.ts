import { CREDIT_REPORT_STYLE, LOGO_URL, PDF_BAND, esc } from "@/lib/credit-report-template";
import type { CalculoSalvo } from "@/lib/analise-estruturada/calculo-pedido";
import type { StatusDocumentos } from "@/lib/analise-estruturada/documentos";
import { planoDeAcao } from "@/lib/analise-estruturada/plano-acao";
import { TERMO_CLAUSULAS, TERMO_TITULO, TERMO_VALIDADO_JURIDICO, TERMO_VERSAO } from "@/lib/analise-estruturada/termo";

// Parecer técnico da Análise Estruturada V3 em HTML (entrega 4), no mesmo visual do
// dossiê de crédito (navy + dourado, cabeçalho e rodapé do Puppeteer). Só monta texto a
// partir do cálculo salvo: nenhum número é produzido aqui.

export type Veredito = "apto" | "apto_com_ressalvas" | "nao_apto";
export const VEREDITO_LABEL: Record<Veredito, { titulo: string; texto: string; classe: string }> = {
  apto: { titulo: "Apto para o mercado de crédito", texto: "Os números sustentam uma nova operação dentro da capacidade calculada.", classe: "hl-green" },
  apto_com_ressalvas: { titulo: "Apto com ressalvas", texto: "Há espaço para crédito, desde que os pontos de atenção sejam tratados ou mitigados na estrutura da operação.", classe: "hl-gold" },
  nao_apto: { titulo: "Ainda não apto", texto: "Hoje a operação não se sustenta. O plano de ação mostra o caminho para chegar ao crédito.", classe: "hl-red" },
};

export function sugerirVeredito(calculo: CalculoSalvo): Veredito {
  const altos = calculo.alertas.filter((a) => a.nivel === "alto");
  if (altos.some((a) => a.tema === "Capacidade" || a.tema === "Resultado")) return "nao_apto";
  // Rating V3 2.0 (Fase 2): faixa D/E não sustenta operação; C pede ressalvas.
  if (calculo.rating && (calculo.rating.faixa === "D" || calculo.rating.faixa === "E")) return "nao_apto";
  if (calculo.rating?.faixa === "C") return "apto_com_ressalvas";
  if (altos.length || calculo.alertas.filter((a) => a.nivel === "medio").length >= 3) return "apto_com_ressalvas";
  return "apto";
}

export interface DadosParecer {
  protocolo: string;
  cliente: string;
  documento: string | null;
  partner: string | null;
  propostaCodigo: string | null;
  emitidoEm: string;            // ISO
  calculo: CalculoSalvo;
  documentos: StatusDocumentos;
  veredito: Veredito;
  comentarioAnalista: string | null;
  assinatura: { analista: string; em: string } | null;
}

const brl = (v: number | null | undefined) =>
  v == null ? '<span class="na">não disponível</span>' : esc(v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const pct = (v: number | null | undefined) => (v == null ? '<span class="na">—</span>' : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const dec = (v: number | null | undefined, s = "") => (v == null ? '<span class="na">—</span>' : `${v.toFixed(2).replace(".", ",")}${s}`);
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const dataHoraBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const docFmt = (d: string | null) => {
  const x = (d ?? "").replace(/\D/g, "");
  if (x.length === 14) return x.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (x.length === 11) return x.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d ?? "";
};

const ESTILO_EXTRA = `
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
.kpi { background: var(--nc); border: 1px solid var(--nm); border-radius: 8px; padding: 14px; }
.kpi .v { font-size: 18px; font-weight: 800; color: var(--cr); }
.kpi .v.gold { color: var(--go); }
.kpi .l { font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gl); margin-bottom: 4px; }
.veredito { font-size: 17px; font-weight: 800; color: var(--cr); margin-bottom: 4px; }
ul.lista { margin: 8px 0 8px 18px; font-size: 12.5px; color: var(--mu); }
ul.lista li { margin-bottom: 4px; }
ul.lista li strong { color: var(--cr); }
.tag { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; }
.tag-alto { background: rgba(190,72,72,0.18); color: #E58A8A; }
.tag-medio { background: rgba(201,168,76,0.15); color: var(--gl); }
.tag-info { background: rgba(155,175,197,0.15); color: var(--mu); }
.ok { color: #7CC49B; font-weight: 700; }
.nok { color: #E58A8A; font-weight: 700; }
.termo p { font-size: 11px; color: var(--mu); margin-bottom: 7px; line-height: 1.55; }
.termo p strong { color: var(--cr); }
.assinatura { margin-top: 26px; padding: 18px 22px; border: 1px solid var(--go); border-radius: 8px; background: var(--nc); }
.marca-minuta { position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-24deg);
  font-size: 54px; font-weight: 800; letter-spacing: 0.1em; color: rgba(229,138,138,0.14); pointer-events: none; z-index: 0; }
.quebra { break-before: page; }
`;

export function htmlParecer(d: DadosParecer): string {
  const c = d.calculo;
  const cap = c.capacidade as Record<string, unknown>;
  const n = (k: string) => (typeof cap[k] === "number" ? (cap[k] as number) : null);
  const credito = (cap.creditoMaximo as Array<{ prazoMeses: number; creditoMaximo: number }>) ?? [];
  const estresse = (cap.estresse as Array<{ cenario: string; caixaMensal: number | null; icsd: number | null }>) ?? [];
  const v = VEREDITO_LABEL[d.veredito];
  const plano = planoDeAcao(c.alertas);
  const ultimo = c.indicadores.filter((i) => !i.parcial).slice(-1)[0] ?? null;
  const pj = c.perfil === "PJ";
  const credito60 = credito.find((x) => x.prazoMeses === 60)?.creditoMaximo ?? null;
  const rascunho = !d.assinatura;

  const kpis = pj
    ? [
        ["Caixa mensal considerado", brl(n("caixaMensal")), false],
        ["ICSD atual (mínimo 1,30)", dec(n("icsdAtual")), true],
        ["Parcela máxima nova", brl(n("parcelaMaximaNova")), true],
        ["Crédito máximo em 60 meses", brl(credito60), true],
      ]
    : [
        ["Renda mensal considerada", brl(n("rendaMensal")), false],
        ["Comprometimento atual", pct(n("comprometimentoAtual")), true],
        ["Parcela máxima nova", brl(n("parcelaMaximaNova")), true],
        ["Crédito máximo em 60 meses", brl(credito60), true],
      ];

  const alertasHtml = c.alertas.length
    ? c.alertas.map((a) => `<li><span class="tag tag-${a.nivel}">${a.nivel === "alto" ? "alto" : a.nivel === "medio" ? "médio" : "info"}</span> <strong>${esc(a.tema)}:</strong> ${esc(a.texto)}</li>`).join("")
    : "<li>Nenhum ponto de atenção relevante nos documentos analisados.</li>";

  const linhasIndicadores: Array<[string, (i: (typeof c.indicadores)[number]) => string]> = [
    ["Receita líquida", (i) => brl(i.receitaLiquida)], ["EBITDA", (i) => brl(i.ebitda)],
    ["Margem bruta", (i) => pct(i.margemBruta)], ["Margem EBITDA", (i) => pct(i.margemEbitda)], ["Margem líquida", (i) => pct(i.margemLiquida)],
    ["Liquidez corrente", (i) => dec(i.liquidezCorrente)], ["Liquidez seca", (i) => dec(i.liquidezSeca)],
    ["Endividamento geral", (i) => pct(i.endividamentoGeral)], ["Dívida no curto prazo", (i) => pct(i.composicaoCurtoPrazo)],
    ["Dívida líquida ÷ EBITDA", (i) => dec(i.dividaLiquidaEbitda, "×")], ["EBITDA ÷ despesa financeira", (i) => dec(i.ebitdaDespesaFinanceira, "×")],
    ["Ciclo financeiro", (i) => (i.cicloFinanceiroDias == null ? '<span class="na">—</span>' : `${i.cicloFinanceiroDias} dias`)],
    ["Necessidade de capital de giro", (i) => brl(i.ncg)], ["Saldo de tesouraria", (i) => brl(i.saldoTesouraria)],
  ];

  const secaoFinanceira = pj && c.indicadores.length ? `
    <h3 class="sec">3. Saúde financeira</h3>
    <p class="note">Indicadores calculados a partir dos balanços e DREs enviados${c.crescimentoReceita != null ? `. Receita ${c.crescimentoReceita >= 0 ? "cresceu" : "caiu"} ${pct(Math.abs(c.crescimentoReceita))} no último exercício` : ""}.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Indicador</th>${c.indicadores.map((i) => `<th>${esc(i.periodo ?? "")}${i.parcial ? " (parcial)" : ""}</th>`).join("")}</tr></thead>
    <tbody>${linhasIndicadores.map(([r, f]) => `<tr><td><strong>${r}</strong></td>${c.indicadores.map((i) => `<td>${f(i)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${c.faturamento ? `<p class="note">Faturamento dos últimos 12 meses: <strong>${brl(c.faturamento.total)}</strong>, média de ${brl(c.faturamento.mediaMensal)} por mês; ${c.faturamento.tendencia3m == null ? "" : Math.abs(c.faturamento.tendencia3m) < 0.01 ? "últimos 3 meses estáveis em relação aos 3 anteriores." : `últimos 3 meses ${c.faturamento.tendencia3m > 0 ? "acima" : "abaixo"} dos 3 anteriores (${pct(c.faturamento.tendencia3m)}).`}</p>` : ""}
  ` : "";

  const raio = c.raioX;
  const secaoRaio = raio ? `
    <h3 class="sec">${pj ? "6" : "5"}. Raio-X de custos bancários</h3>
    <p class="note">Leitura de ${raio.mesesAnalisados} meses de extrato. Custo projetado em 12 meses: <strong>${brl(raio.projecaoAnual)}</strong>. Economia potencial estimada: <strong>${brl(raio.economiaAnualEstimada)} por ano</strong>.${raio.pacoteEmMaisDeUmBanco.length ? ` Pacote de serviços cobrado em ${raio.pacoteEmMaisDeUmBanco.length} bancos (${esc(raio.pacoteEmMaisDeUmBanco.join(", "))}).` : ""}</p>
    <div class="tbl-wrap"><table><thead><tr><th>Categoria</th><th>Custo em 12 meses</th><th>Economia estimada</th><th>O que fazer</th></tr></thead>
    <tbody>${raio.categorias.map((cat) => `<tr><td><strong>${esc(cat.nome)}</strong></td><td>${brl(cat.projecaoAnual)}</td><td>${brl(cat.economiaAnualEstimada)}</td><td>${esc(cat.acao)}</td></tr>`).join("")}</tbody></table></div>
    ${raio.recorrentes.length ? `<p class="note">Cobranças recorrentes: ${raio.recorrentes.slice(0, 8).map((r) => `${esc(r.descricao)}${r.banco ? ` (${esc(r.banco)})` : ""} ${brl(r.valorAtual)}${r.aumentou ? " — aumentou" : ""}`).join("; ")}.</p>` : ""}
    <p class="note">A economia é uma estimativa. Seguro exigido junto com empréstimo deve ser verificado antes de qualquer cancelamento.</p>
  ` : "";

  const n2 = pj ? 4 : 3;
  const docsUsados = d.documentos.itens.filter((i) => i.arquivos.length).map((i) => `<li><strong>${esc(i.label)}:</strong> ${i.arquivos.length} arquivo${i.arquivos.length > 1 ? "s" : ""}</li>`).join("");
  const docsFaltando = d.documentos.itens.filter((i) => !i.arquivos.length).map((i) => esc(i.label));

  const body = `
  ${!TERMO_VALIDADO_JURIDICO ? '<div class="marca-minuta">MINUTA</div>' : rascunho ? '<div class="marca-minuta">RASCUNHO</div>' : ""}
  <div class="gold-stripe"></div>
  <div class="doc-body">
    <div class="report-header">
      <div>
        <img src="${LOGO_URL}" alt="V3 Partners">
        <div class="report-eyebrow">Parecer técnico · Análise Estruturada V3</div>
        <div class="report-title">${esc(d.cliente)}</div>
      </div>
      <div class="report-meta">
        Protocolo <strong>${esc(d.protocolo)}</strong><br>
        Emitido em <strong>${dataBR(d.emitidoEm)}</strong><br>
        Válido até <strong>${dataBR(new Date(new Date(d.emitidoEm).getTime() + 30 * 864e5).toISOString())}</strong><br>
        <span class="confidential-badge">Confidencial</span>
      </div>
    </div>

    <div class="subject-block">
      <div><div class="subject-field-label">${pj ? "Empresa" : "Cliente"}</div><div class="subject-field-value">${esc(d.cliente)}</div></div>
      <div><div class="subject-field-label">${pj ? "CNPJ" : "CPF"}</div><div class="subject-field-value">${esc(docFmt(d.documento)) || '<span class="na">—</span>'}</div></div>
      <div><div class="subject-field-label">Proposta · Partner</div><div class="subject-field-value">${esc(d.propostaCodigo ?? "—")}${d.partner ? ` · ${esc(d.partner)}` : ""}</div></div>
    </div>

    <h3 class="sec">1. Resumo executivo</h3>
    <div class="hl ${v.classe}"><div class="veredito">${v.titulo}</div>${v.texto}</div>
    <div class="kpis">${kpis.map(([l, val, g]) => `<div class="kpi"><div class="l">${l}</div><div class="v ${g ? "gold" : ""}">${val}</div></div>`).join("")}</div>
    ${c.rating ? `
    <div class="tier-block">
      <div class="tier-card"><div class="tier-v">${c.rating.faixa}</div><div class="tier-l">Rating V3 2.0 · ${c.rating.nota}/100</div>
        <p class="note" style="margin-top:8px">Confiança ${c.rating.confianca === "alto" ? "alta" : c.rating.confianca === "medio" ? "média" : "baixa"}</p></div>
      <div>
        <p class="note"><strong style="color:var(--cr)">${esc(c.rating.leitura)}</strong></p>
        <p class="note">Com as ações do plano cumpridas, a nota projetada é <strong style="color:var(--go)">${c.rating.notaProjetada} (faixa ${c.rating.faixaProjetada})</strong>.</p>
        ${c.rating.travas.length ? `<p class="note" style="color:#E58A8A">Travas que limitam a nota: ${esc(c.rating.travas.join("; "))}.</p>` : ""}
        ${c.rating.motivosConfianca.length ? `<p class="note">${esc(c.rating.motivosConfianca.join("; "))}.</p>` : ""}
      </div>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Pilar do rating</th><th>Peso</th><th>Nota</th><th>O que pesou</th></tr></thead>
    <tbody>${c.rating.pilares.map((p) => `<tr><td><strong>${esc(p.nome)}</strong></td><td>${p.peso}%</td><td><strong>${p.nota ?? "—"}</strong></td><td>${esc(p.motivos.join(" · ") || (p.nota == null ? "Sem dados suficientes" : ""))}</td></tr>`).join("")}</tbody></table></div>
    ` : ""}
    ${d.comentarioAnalista ? `<div class="hl hl-gold"><strong>Comentário do analista:</strong> ${esc(d.comentarioAnalista).replace(/\n/g, "<br>")}</div>` : ""}
    <p class="note">Principais pontos de atenção:</p>
    <ul class="lista">${c.alertas.slice(0, 5).map((a) => `<li><strong>${esc(a.tema)}:</strong> ${esc(a.texto)}</li>`).join("") || "<li>Nenhum ponto de atenção relevante.</li>"}</ul>

    <h3 class="sec">2. Capacidade de pagamento</h3>
    <p class="note">${pj
      ? `Caixa mensal considerado: o menor entre o EBITDA mensal da DRE (${brl(n("ebitdaMensal"))}) e o fluxo operacional dos extratos (${brl(n("fluxoExtratosMensal"))}). Parcelas atuais de ${brl(n("servicoDividaMensal"))}${cap.fonteServico ? ` (${esc(String(cap.fonteServico))})` : ""}.`
      : `Renda mensal considerada: o menor entre o IR (${brl(n("rendaIrMensal"))}), os comprovantes (${brl(n("rendaComprovadaMensal"))}) e as entradas nos extratos (${brl(n("entradasExtratosMensal"))}). Parcelas atuais de ${brl(n("servicoDividaMensal"))}.`}
      ${pj ? `A nova parcela respeita cobertura mínima (ICSD) de ${dec(c.premissas.icsdPiso)}.` : `A nova parcela respeita comprometimento máximo de ${pct(c.premissas.comprometimentoPF)} da renda.`}</p>
    <div class="tbl-wrap"><table><thead><tr><th>Prazo</th><th>Crédito máximo suportável</th></tr></thead>
    <tbody>${credito.map((x) => `<tr><td><strong>${x.prazoMeses} meses</strong></td><td>${brl(x.creditoMaximo)}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">Valores calculados à taxa de referência de ${pct(c.premissas.taxaReferenciaMensal)} ao mês; a taxa real depende da linha e da garantia.</p>
    ${estresse.length ? `<p class="note">Teste de estresse:</p>
    <div class="tbl-wrap"><table><thead><tr><th>Cenário</th><th>Caixa mensal</th><th>ICSD</th></tr></thead>
    <tbody>${estresse.map((e) => `<tr><td><strong>${esc(e.cenario)}</strong></td><td>${brl(e.caixaMensal)}</td><td class="${e.icsd != null && e.icsd < 1 ? "nok" : ""}">${dec(e.icsd)}</td></tr>`).join("")}</tbody></table></div>` : ""}

    ${secaoFinanceira}

    <h3 class="sec">${n2}. Validação cruzada dos documentos</h3>
    ${c.cruzamentos.length ? `<div class="tbl-wrap"><table><thead><tr><th>Cruzamento</th><th>Resultado</th><th></th></tr></thead>
    <tbody>${c.cruzamentos.map((x) => `<tr><td><strong>${esc(x.cruzamento)}</strong></td><td>${esc(x.resultado)}</td><td class="${x.ok === false ? "nok" : "ok"}">${x.ok === false ? "atenção" : x.ok ? "ok" : "—"}</td></tr>`).join("")}</tbody></table></div>`
      : '<p class="note">Não houve documentos suficientes para cruzamentos.</p>'}

    <h3 class="sec">${n2 + 1}. Pontos de atenção</h3>
    <ul class="lista">${alertasHtml}</ul>

    ${secaoRaio}

    <h3 class="sec">${raio ? n2 + 3 : n2 + 2}. Plano de ação para acesso ao crédito</h3>
    ${plano.length ? `<div class="tbl-wrap"><table><thead><tr><th>Prazo</th><th>Ação recomendada</th><th>Por quê</th></tr></thead>
    <tbody>${plano.map((p) => `<tr><td><strong>${esc(p.prazo)}</strong></td><td>${esc(p.acao)}</td><td>${esc(p.achado)}</td></tr>`).join("")}</tbody></table></div>`
      : '<p class="note">Sem ações prioritárias: manter a disciplina financeira atual.</p>'}

    <h3 class="sec">Documentos analisados e metodologia</h3>
    <ul class="lista">${docsUsados}</ul>
    ${docsFaltando.length ? `<p class="note">Não enviados: ${docsFaltando.join(", ")}.</p>` : ""}
    <p class="note">Os documentos foram lidos com apoio de inteligência artificial e conferidos pela Mesa de Crédito da V3. Todos os indicadores, a capacidade de pagamento, os testes de estresse e o raio-X de custos são calculados por fórmulas fixas sobre esses números. Premissas: cobertura mínima ${dec(c.premissas.icsdPiso)}; taxa de referência ${pct(c.premissas.taxaReferenciaMensal)} a.m.; estresse com receita −${pct(c.premissas.estresseQuedaReceita)} e juros +${pct(c.premissas.estresseJurosAnual)} ao ano.${ultimo?.periodo ? ` Último exercício considerado: ${esc(ultimo.periodo)}.` : ""}</p>

    <div class="quebra"></div>
    <h3 class="sec termo-titulo">${TERMO_TITULO}${!TERMO_VALIDADO_JURIDICO ? " (minuta pendente de validação jurídica)" : ""}</h3>
    <div class="termo">${TERMO_CLAUSULAS.map((t, i) => `<p><strong>${i + 1}. ${esc(t.titulo)}.</strong> ${esc(t.texto)}</p>`).join("")}</div>
    <p class="note">Versão do termo: ${esc(TERMO_VERSAO)}.</p>

    <div class="assinatura">
      ${d.assinatura
        ? `<div class="subject-field-label">Revisado e assinado eletronicamente</div><div class="subject-field-value">${esc(d.assinatura.analista)} · Mesa de Crédito V3 Partners</div><p class="note" style="margin-top:6px">Em ${dataHoraBR(d.assinatura.em)}. Protocolo ${esc(d.protocolo)}.</p>`
        : `<div class="subject-field-label">Rascunho</div><p class="note" style="margin-top:6px">Aguardando revisão e assinatura do analista da Mesa de Crédito.</p>`}
    </div>
  </div>
  <div class="gold-stripe"></div>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${CREDIT_REPORT_STYLE}${ESTILO_EXTRA}</style></head><body>${body}</body></html>`;
}

export function opcoesPdfParecer(d: Pick<DadosParecer, "protocolo" | "emitidoEm">) {
  const header = PDF_BAND(
    `<span style="font-weight:700;color:#E8C97A">V3 Partners · Parecer Técnico · Análise Estruturada</span>` +
      `<span style="color:#9BAFC5">Protocolo ${esc(d.protocolo)} · Emitido em ${dataBR(d.emitidoEm)}</span>`,
    { align: "flex-start", pad: "7mm 14mm 0", borda: "border-bottom:0.5px solid rgba(36,58,102,0.9);padding-bottom:3mm" },
  );
  const footer = PDF_BAND(
    `<span style="color:#9BAFC5">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span>` +
      `<span style="color:#9BAFC5">Confidencial · uso exclusivo do destinatário</span>` +
      `<span style="font-weight:700;color:#E8C97A">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>`,
    { align: "flex-end", pad: "0 14mm 7mm", borda: "border-top:0.5px solid rgba(36,58,102,0.9);padding-top:3mm" },
  );
  return {
    format: "A4" as const, printBackground: true, preferCSSPageSize: false, displayHeaderFooter: true,
    headerTemplate: header, footerTemplate: footer,
    margin: { top: "26mm", bottom: "20mm", left: "0", right: "0" },
  };
}

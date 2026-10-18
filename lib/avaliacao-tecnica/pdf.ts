// Laudo em PDF da Avaliação Técnica V3 (18/10/2026, pedido do Hamilton): o mesmo conteúdo do
// card da aba Avaliação de Imóvel, no formato dos laudos de referência (identificação, registro,
// áreas, características, GEO, mercado, valores, rating e parecer). HTML → PDF pelo Chromium
// (igual à cobrança do mandato); a rota grava o arquivo no storage da proposta.

import { TIPO_DOC_LABEL, type AvaliacaoTecnica, type Poligonal } from "./tipos";
import { diasDesde } from "./analise";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const vazio = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const t = (v: unknown) => (vazio(v) ? "—" : esc(Array.isArray(v) ? v.join(", ") : v));
const brl = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const num = (v: number | null | undefined, casas = 2) =>
  typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) : "—";
const dataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const ACEITE = { ACEITAR: "Aceitar", ACEITAR_COM_RESSALVAS: "Aceitar com ressalvas", NAO_RECOMENDADO: "Não recomendado" } as const;
const NIVEL = { CRITICO: "Crítico", ATENCAO: "Atenção", INFO: "Info" } as const;

function linhas(pares: [string, string][]) {
  return `<table class="kv">${pares.map(([r, v]) => `<tr><td class="r">${esc(r)}</td><td class="v">${v}</td></tr>`).join("")}</table>`;
}

function lista(itens: string[] | undefined) {
  return itens && itens.length ? `<ul>${itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="m">—</p>`;
}

function svgPoligonal(p: Poligonal) {
  const W = 520, H = 300, pad = 18;
  const k = Math.cos((p.centroide.lat * Math.PI) / 180);
  const xs = p.vertices.map((v) => v.lon * k);
  const ys = p.vertices.map((v) => v.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const e = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * e) / 2;
  const oy = (H - (y1 - y0) * e) / 2;
  const pts = p.vertices.map((v, i) => `${(ox + (xs[i] - x0) * e).toFixed(1)},${(H - (oy + (ys[i] - y0) * e)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="border:1px solid #E5E1D8;border-radius:8px;background:#111F35">
    <polygon points="${pts.join(" ")}" fill="rgba(201,168,76,.18)" stroke="#C9A84C" stroke-width="1.8" stroke-linejoin="round"/>
    <g transform="translate(${W - 24},26)"><path d="M0,-13 L6,5 L0,1 L-6,5 Z" fill="#F0ECE4"/><text y="17" text-anchor="middle" font-size="9" fill="#7A8FA8">N</text></g>
  </svg>`;
}

export function codigoLaudo(propostaCode: string | null | undefined, idx: number) {
  return `V3-AVT-${(propostaCode ?? "PROPOSTA").replace(/[^A-Za-z0-9-]/g, "")}-${idx + 1}`;
}

export function htmlLaudoAvaliacao(opts: {
  av: AvaliacaoTecnica;
  codigo: string;
  propostaCode?: string | null;
  clienteNome?: string | null;
  valorSolicitado?: number | null;
  emitidoEm: Date;
  emitidoPor?: string | null;
}): string {
  const { av, codigo } = opts;
  const v = av.valores;
  const rural = av.zona === "RURAL";
  const un = v.unidade === "ha" ? "ha" : "m²";
  const id = av.identificacao;
  const a = av.areas;
  const solicitado = opts.valorSolicitado ?? av.valor_solicitado ?? null;
  const ltv = solicitado && v.valor_liquidez ? solicitado / v.valor_liquidez : null;
  const diasMat = diasDesde(id.data_certidao);
  const mapa = av.localizacao ? `https://www.google.com/maps?q=${av.localizacao.lat},${av.localizacao.lon}` : null;

  // ── Características ──
  let caracteristicas = "";
  if (!rural && av.urbano) {
    const u = av.urbano;
    const c = u.condominio;
    caracteristicas = `
      <div class="g2">
        <div><h3>Construção</h3>${linhas([
          ["Tipo", t(u.tipo)], ["Padrão construtivo", t(u.padrao_descricao ?? u.padrao)], ["Idade aparente", u.idade_aparente_anos ? `${u.idade_aparente_anos} anos` : "—"],
          ["Conservação", t(u.conservacao)], ["Pavimentos", t(u.pavimentos)], ["Dorm. / suítes / vagas", `${t(u.dormitorios)} / ${t(u.suites)} / ${t(u.vagas)}`],
          ["Estrutura", t(u.estrutura)], ["Cobertura", t(u.cobertura)], ["Esquadrias", t(u.esquadrias)], ["Lazer", t(u.lazer)],
        ])}</div>
        <div><h3>Terreno e entorno</h3>${linhas([
          ["Situação", t(u.situacao)], ["Topografia", t(u.topografia)], ["Formato / testada", `${t(u.formato_terreno)}${u.testada_m ? ` · ${num(u.testada_m)} m` : ""}`],
          ["Zoneamento", t(u.zoneamento)], ["Ocupação", t(u.ocupacao)], ["Infraestrutura", t(u.infraestrutura)], ["Vizinhança", t(u.vizinhanca)],
          ["Serviços próximos", t(u.servicos_proximos)], ["Riscos", t(u.riscos)],
        ])}</div>
      </div>
      ${c?.em_condominio != null ? `<h3>Condomínio</h3>${linhas([
        ["Em condomínio", c.em_condominio ? (c.tipo === "VERTICAL" ? "Sim · edifício" : c.tipo === "HORIZONTAL" ? "Sim · condomínio fechado" : "Sim") : "Não (imóvel de rua)"],
        ...(c.em_condominio ? [["Nome", t(c.nome ?? id.denominacao)], ["Taxa mensal", brl(c.taxa_mensal)], ["Infraestrutura", t(c.infraestrutura)]] as [string, string][] : []),
      ])}` : ""}
      ${u.acabamentos?.length ? `<h3>Acabamentos</h3><table class="t"><tr><th>Ambiente</th><th>Piso / parede / teto</th></tr>${u.acabamentos.map((x) => `<tr><td>${esc(x.ambiente)}</td><td>${esc(x.descricao)}</td></tr>`).join("")}</table>` : ""}
      ${u.iptu ? `<h3>IPTU</h3>${linhas([
        ["Inscrição", t(id.inscricao_municipal)], ["Exercício", t(u.iptu.exercicio)], ["Venal terreno / construção", `${brl(u.iptu.valor_venal_terreno)} / ${brl(u.iptu.valor_venal_construcao)}`],
        ["Valor venal total", brl(u.iptu.valor_venal_total)], ["IPTU anual", brl(u.iptu.valor_iptu_anual)], ["Débitos", t(u.iptu.debitos)],
      ])}` : ""}`;
  } else if (rural && av.rural) {
    const r = av.rural;
    caracteristicas = `
      <div class="g2">
        <div><h3>CCIR / INCRA</h3>${linhas([
          ["Código INCRA", t(r.codigo_incra)], ["CCIR", `${t(r.ccir?.numero)}${r.ccir?.exercicio ? ` · ${esc(r.ccir.exercicio)}` : ""}`], ["Situação", t(r.ccir?.situacao)],
          ["Módulos fiscais", `${t(r.ccir?.modulos_fiscais)}${r.modulo_fiscal_ha ? ` (módulo de ${num(r.modulo_fiscal_ha)} ha)` : ""}`], ["Classificação", t(r.ccir?.classificacao ?? r.porte)],
        ])}
        <h3>ITR / Receita Federal</h3>${linhas([
          ["NIRF / CIB", t(r.itr?.nirf)], ["Exercício", t(r.itr?.exercicio)], ["VTN declarado", brl(r.itr?.vtn_declarado)], ["Situação", t(r.itr?.situacao)],
        ])}</div>
        <div><h3>CAR / Ambiental</h3>${linhas([
          ["Código", t(r.car?.codigo)], ["Situação", t(r.car?.situacao)], ["Reserva Legal", r.car?.reserva_legal_ha ? `${num(r.car.reserva_legal_ha, 4)} ha` : "—"],
          ["APP", r.car?.app_ha ? `${num(r.car.app_ha, 4)} ha` : "—"], ["Vegetação nativa", r.car?.vegetacao_nativa_ha ? `${num(r.car.vegetacao_nativa_ha, 4)} ha` : "—"],
          ["Bioma / RL exigida", `${t(r.bioma)}${r.reserva_legal_exigida_pct ? ` · ${r.reserva_legal_exigida_pct}%` : ""}`],
        ])}
        <h3>Campo</h3>${linhas([
          ["Aptidão", t(r.aptidao)], ["Uso do solo", t(r.uso_solo)], ["Recursos hídricos", t(r.recursos_hidricos)], ["Cercas", t(r.cercas)],
          ["Acesso", t(r.acesso)], ["Servidão de passagem", t(r.servidao_passagem)],
        ])}</div>
      </div>
      ${r.edificacoes?.length ? `<h3>Benfeitorias</h3><table class="t"><tr><th>Edificação</th><th>Área</th><th>Idade</th><th>Conservação</th><th>Averbada</th></tr>${r.edificacoes.map((e) => `<tr><td>${esc(e.nome)}${e.descricao ? `<br><span class="m">${esc(e.descricao)}</span>` : ""}</td><td>${e.area_m2 ? `${num(e.area_m2)} m²` : "—"}</td><td>${e.idade_aparente_anos ? `${e.idade_aparente_anos} anos` : "—"}</td><td>${t(e.conservacao)}</td><td>${e.averbada === true ? "Sim" : e.averbada === false ? "Não" : "—"}</td></tr>`).join("")}</table>` : ""}`;
  }

  // ── Áreas ──
  const areas: [string, string][] = rural
    ? [
        ["Matrícula", a.matricula_ha ? `${num(a.matricula_ha, 4)} ha` : "—"], ["GEO calculada (vértices)", a.geo_calculada_ha ? `${num(a.geo_calculada_ha, 4)} ha` : "—"],
        ["GEO memorial", a.geo_declarada_ha ? `${num(a.geo_declarada_ha, 4)} ha` : "—"], ["CCIR", a.ccir_ha ? `${num(a.ccir_ha, 4)} ha` : "—"],
        ["ITR", a.itr_ha ? `${num(a.itr_ha, 4)} ha` : "—"], ["CAR", a.car_ha ? `${num(a.car_ha, 4)} ha` : "—"],
      ]
    : [
        ["Privativa", a.privativa_m2 ? `${num(a.privativa_m2)} m²` : "—"], ["Construída (real/estimada)", a.construida_estimada_m2 ? `${num(a.construida_estimada_m2)} m²` : "—"],
        ["Construída IPTU", a.construida_iptu_m2 ? `${num(a.construida_iptu_m2)} m²` : "—"], ["Construída matrícula", a.construida_matricula_m2 ? `${num(a.construida_matricula_m2)} m²` : "—"],
        ["Terreno matrícula", a.terreno_matricula_m2 ? `${num(a.terreno_matricula_m2)} m²` : "—"], ["Terreno IPTU", a.terreno_iptu_m2 ? `${num(a.terreno_iptu_m2)} m²` : "—"],
      ];

  // ── Mercado ──
  const comps = av.mercado?.comparaveis ?? [];
  const mercado = comps.length
    ? `<table class="t"><tr><th>#</th><th>Comparável</th><th>Valor</th><th>Área</th><th>R$/${un}</th><th>Situação</th></tr>${comps.map((c, i) => {
        const noRecorte = v.no_recorte?.[i] ?? true;
        const ok = noRecorte && (v.saneados?.[i] ?? true);
        const tag = c.mesmo_condominio ? "mesmo condomínio" : c.em_condominio === true ? "em condomínio" : c.em_condominio === false ? "de rua" : "";
        return `<tr class="${ok ? "" : "x"}"><td>${i + 1}</td><td>${esc(c.titulo)}${c.fonte_nome ? `<br><span class="m">${esc(c.fonte_nome)}${tag ? ` · ${tag}` : ""}</span>` : tag ? `<br><span class="m">${tag}</span>` : ""}</td><td>${brl(c.valor)}</td><td>${num(c.area, v.unidade === "ha" ? 2 : 0)} ${un}</td><td>${brl(c.preco_unitario)}</td><td>${ok ? "Aceito" : !noRecorte ? "Fora do recorte" : "Saneado"}</td></tr>`;
      }).join("")}</table>
      <p class="m">Metodologia: comparativo direto de dados de mercado (NBR 14653). Anúncios × fator de oferta ${num(v.fator_oferta)}; saneamento ±30% da média${typeof v.amostra_saneada === "number" ? ` (${v.amostra_saneada} de ${v.amostra_total} aceitos)` : ""}${v.amostra_criterio ? `; recorte: ${esc(v.amostra_criterio)}` : ""}${typeof v.premio_condominio_pct === "number" ? `; R$/m² em condomínio ${v.premio_condominio_pct >= 0 ? "+" : ""}${num(v.premio_condominio_pct * 100, 0)}% sobre os de rua` : ""}. Unitário aplicado: ${esc(v.criterio)}. Confiança da amostra: ${esc(av.mercado?.confianca?.toLowerCase())}.</p>
      ${av.mercado?.resumo_regiao ? `<p>${esc(av.mercado.resumo_regiao)}</p>` : ""}`
    : `<p class="m">Nenhum comparável encontrado na internet para a região.</p>`;

  const alertas = av.alertas.length
    ? `<table class="t"><tr><th>Nível</th><th>Categoria</th><th>Ponto</th></tr>${av.alertas.map((x) => `<tr><td><span class="nv ${x.nivel.toLowerCase()}">${NIVEL[x.nivel]}</span></td><td>${esc(x.categoria)}</td><td><b>${esc(x.titulo)}</b>${x.detalhe ? `<br><span class="m">${esc(x.detalhe)}</span>` : ""}</td></tr>`).join("")}</table>`
    : `<p class="m">Nenhum alerta.</p>`;

  const geo = rural && av.poligonal ? `
    <h2>GEO / Poligonal</h2>
    <div class="g2">
      <div>${svgPoligonal(av.poligonal)}</div>
      <div>${linhas([
        ["Fonte", t(av.poligonal.fonte)], ["Vértices", String(av.poligonal.vertices.length)], ["Área calculada", `${num(av.poligonal.area_ha, 4)} ha`],
        ["Perímetro", `${num(av.poligonal.perimetro_m, 2)} m`], ["Centroide", `${num(av.poligonal.centroide.lat, 6)}, ${num(av.poligonal.centroide.lon, 6)}`],
        ["Município do centroide", `${t(av.poligonal.municipio_centroide)}${av.poligonal.uf_centroide ? `/${esc(av.poligonal.uf_centroide)}` : ""}`],
        ["Certificação SIGEF", `${av.rural?.geo?.certificado === true ? "Certificado" : av.rural?.geo?.certificado === false ? "Não certificado" : "—"}${av.rural?.geo?.codigo_parcela ? ` · ${esc(av.rural.geo.codigo_parcela)}` : ""}`],
        ["Averbado na matrícula", av.rural?.geo?.averbado_na_matricula === true ? "Sim" : av.rural?.geo?.averbado_na_matricula === false ? "Não" : "—"],
      ])}</div>
    </div>` : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>
  @page { size: A4; margin: 14mm 0 16mm; }
  @page :first { margin-top: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DM Sans", Arial, sans-serif; color: #111F35; font-size: 10.5px; line-height: 1.45; }
  .pg { padding: 36px 44px 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #C9A84C; padding-bottom: 14px; }
  .top .cod { text-align: right; font-size: 10px; color: #4A5A70; line-height: 1.6; }
  .top .cod b { color: #111F35; font-size: 12px; }
  h1 { font-size: 20px; margin: 20px 0 2px; }
  .sub { color: #4A5A70; margin: 0 0 14px; }
  h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #A88A35; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #E5E1D8; break-after: avoid; }
  h3 { font-size: 10.5px; margin: 10px 0 4px; color: #111F35; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; break-inside: auto; }
  tr { break-inside: avoid; }
  table.kv td { padding: 4px 6px; border-bottom: 1px solid #EFEBE3; vertical-align: top; }
  table.kv td.r { color: #4A5A70; width: 42%; }
  table.kv td.v { font-weight: 500; }
  table.t th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .6px; color: #4A5A70; padding: 5px 6px; border-bottom: 1.5px solid #C9A84C; }
  table.t td { padding: 5px 6px; border-bottom: 1px solid #EFEBE3; vertical-align: top; }
  table.t tr.x td { color: #9AA7B8; text-decoration: line-through; }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .m { color: #6B7A90; font-size: 9.5px; }
  .faixa { display: grid; grid-template-columns: repeat(4, 1fr) 92px; gap: 8px; margin-top: 8px; }
  .box { background: #111F35; color: #F0ECE4; border-radius: 8px; padding: 10px 12px; }
  .box .l { font-size: 7.5px; text-transform: uppercase; letter-spacing: 1px; color: #E8C97A; }
  .box .n { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .box .s { font-size: 8.5px; color: #C9D2DE; margin-top: 1px; }
  .rt { text-align: center; border: 1.5px solid #C9A84C; background: #FBF8F0; color: #111F35; border-radius: 8px; padding: 8px 4px; }
  .rt .nota { font-size: 26px; font-weight: 800; line-height: 1; }
  .aceite { display: inline-block; margin-top: 10px; padding: 4px 10px; border-radius: 999px; border: 1px solid #C9A84C; background: #FBF8F0; font-weight: 700; font-size: 10px; }
  .nv { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; border: 1px solid #C9A84C; }
  .nv.critico { color: #B91C1C; border-color: #B91C1C; }
  .nv.info { color: #6B7A90; border-color: #CBD3DE; }
  ul { margin: 2px 0 6px 16px; padding: 0; }
  li { margin-bottom: 2px; }
  .nota-legal { margin-top: 22px; padding: 10px 12px; border: 1px solid #E5E1D8; border-radius: 8px; font-size: 9px; color: #4A5A70; background: #FBF8F0; }
  .rod { margin-top: 18px; padding: 10px 0 24px; border-top: 1px solid #E5E1D8; font-size: 8.5px; color: #7A8FA8; display: flex; justify-content: space-between; }
</style></head><body><div class="pg">
  <div class="top">
    <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:52px">
    <div class="cod">Laudo nº <b>${esc(codigo)}</b><br>Emitido em ${dataBR(opts.emitidoEm.toISOString())}${opts.emitidoPor ? ` por ${esc(opts.emitidoPor)}` : ""}${opts.propostaCode ? `<br>Proposta ${esc(opts.propostaCode)}` : ""}<br>Avaliação de ${dataBR(av.gerado_em)}</div>
  </div>

  <h1>Avaliação Técnica do Imóvel em Garantia</h1>
  <p class="sub">${rural ? "Imóvel rural · referência NBR 14653-3" : "Imóvel urbano · referência NBR 14653-2"}${opts.clienteNome ? ` · Proponente: <b>${esc(opts.clienteNome)}</b>` : ""}</p>

  <div class="faixa">
    <div class="box"><div class="l">Valor de mercado</div><div class="n">${brl(v.valor_mercado)}</div><div class="s">${v.preco_unitario_aplicado ? `${brl(v.preco_unitario_aplicado)}/${un}` : "sem comparáveis"}</div></div>
    <div class="box"><div class="l">Valor de liquidez</div><div class="n">${brl(v.valor_liquidez)}</div><div class="s">fator ${num(v.fator_liquidez)} (garantia)</div></div>
    <div class="box"><div class="l">LTV s/ liquidez</div><div class="n">${ltv !== null ? `${num(ltv * 100, 1)}%` : "—"}</div><div class="s">${solicitado ? `solicitado ${brl(solicitado)}` : "máx. 70%"}</div></div>
    <div class="box"><div class="l">Área considerada</div><div class="n">${v.area_considerada ? `${num(v.area_considerada, v.unidade === "ha" ? 4 : 2)} ${un}` : "—"}</div><div class="s">${esc(v.area_criterio)}</div></div>
    <div class="rt"><div class="m">Rating</div><div class="nota">${esc(av.rating.nota)}</div><div class="m">${av.rating.pontos}/100</div></div>
  </div>
  ${v.intervalo_inferior !== null && v.intervalo_superior !== null ? `<p class="m" style="margin-top:6px">Intervalo da amostra saneada: ${brl(v.intervalo_inferior)} a ${brl(v.intervalo_superior)}${v.valor_venal_iptu ? ` · venal IPTU ${brl(v.valor_venal_iptu)}` : ""}${v.vtn_itr ? ` · VTN ITR ${brl(v.vtn_itr)}` : ""}${v.laudo_mercado ? ` · laudo anexado ${brl(v.laudo_mercado)}` : ""}</p>` : ""}
  <span class="aceite">Parecer: ${ACEITE[av.parecer.aceite]}</span>

  <h2>Identificação</h2>
  <div class="g2">
    <div>${linhas([
      ["Matrícula", `${t(id.matricula)}${id.cartorio ? ` · ${esc(id.cartorio)}` : ""}`], ["Comarca", t(id.comarca)],
      ["Certidão emitida em", `${dataBR(id.data_certidao)}${diasMat !== null ? ` (${diasMat} dias)` : ""}`], ["Proprietário(s)", t(id.proprietarios)],
      [rural ? "Denominação" : "Inscrição municipal", rural ? t(id.denominacao) : t(id.inscricao_municipal)],
    ])}</div>
    <div>${linhas([
      ["Endereço", t(id.endereco)], ["Bairro", t(id.bairro)], ["Cidade/UF", `${t(id.cidade)}${id.uf ? `/${esc(id.uf)}` : ""}`], ["CEP", t(id.cep)],
      ["Lote/quadra", t(id.lote_quadra)],
      ["Coordenadas", av.localizacao ? `${num(av.localizacao.lat, 6)}, ${num(av.localizacao.lon, 6)}${mapa ? ` · <a href="${mapa}">mapa</a>` : ""}` : "—"],
    ])}</div>
  </div>

  <h2>Situação registral</h2>
  ${av.registro.onus.length ? `<table class="t"><tr><th>Ônus / gravame</th><th>Registro</th><th>Favorecido</th><th>Situação</th></tr>${av.registro.onus.map((o) => `<tr><td>${esc(o.tipo)}${o.descricao ? `<br><span class="m">${esc(o.descricao)}</span>` : ""}</td><td>${t(o.registro)}</td><td>${t(o.favorecido)}</td><td>${o.ativo ? "<b>Ativo</b>" : "Cancelado"}</td></tr>`).join("")}</table>` : `<p class="m">Nenhum ônus ou gravame identificado na matrícula.</p>`}
  ${linhas([["Construção averbada", t(av.registro.construcao_averbada)], ["Cadeia dominial", t(av.registro.cadeia_dominial)], ["Observações", t(av.registro.observacoes)]])}

  <h2>Quadro de áreas</h2>
  ${linhas(areas)}

  <h2>Características</h2>
  ${caracteristicas || `<p class="m">—</p>`}
  ${av.ambiental ? `<h3>Ambiental</h3><p>${esc(av.ambiental)}</p>` : ""}

  ${geo}

  <h2>Pesquisa de mercado</h2>
  ${mercado}

  <h2>Alertas</h2>
  ${alertas}

  <h2>Rating da garantia</h2>
  <table class="t"><tr><th>Categoria</th><th>Pontos</th></tr>${av.rating.fatores.map((f) => `<tr><td>${esc(f.categoria)}</td><td>${f.pontos} / ${f.max}</td></tr>`).join("")}<tr><td><b>Total</b></td><td><b>${av.rating.pontos} / 100 · nota ${esc(av.rating.nota)}</b></td></tr></table>

  <h2>Parecer técnico</h2>
  <p>${esc(av.parecer.resumo)}</p>
  <div class="g2">
    <div><h3>Pontos fortes</h3>${lista(av.parecer.pontos_fortes)}</div>
    <div><h3>Ressalvas</h3>${lista(av.parecer.ressalvas)}</div>
  </div>
  <h3>Recomendações</h3>${lista(av.parecer.recomendacoes)}
  ${av.documentos_faltantes.length ? `<h3>Documentos faltantes</h3>${lista(av.documentos_faltantes)}` : ""}

  <h2>Documentos analisados</h2>
  <table class="t"><tr><th>Tipo</th><th>Arquivo</th><th>Conteúdo</th></tr>${av.arquivos.map((x) => `<tr><td>${esc(TIPO_DOC_LABEL[x.tipo] ?? x.tipo)}</td><td>${esc(x.file_name)}</td><td>${t(x.resumo)}</td></tr>`).join("")}</table>

  <div class="nota-legal">Avaliação técnica interna da V3 Partners, montada a partir dos documentos anexados à proposta e de anúncios públicos de mercado, seguindo os parâmetros da NBR 14653. Serve de apoio à análise de crédito e não substitui laudo de avaliação assinado por engenheiro ou arquiteto com ART/RRT quando exigido pela instituição financeira.</div>

  <div class="rod"><span>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span><span>${esc(codigo)}</span></div>
</div></body></html>`;
}

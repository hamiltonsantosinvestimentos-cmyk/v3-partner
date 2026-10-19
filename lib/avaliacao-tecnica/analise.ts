// Regras fixas da Avaliação Técnica V3 (17/10/2026): valores, alertas e Rating da Garantia.
// Sem IA — a IA só lê os documentos e pesquisa o mercado; quem decide os números e os
// alertas é este arquivo, para o resultado ser previsível e auditável.
//
// Critérios inspirados nos laudos de referência:
//  - anúncio → negócio: fator de oferta 0,90 (Eagle e Engebanc usam 0,90);
//  - valor de garantia/liquidez: urbano 0,80 do mercado (Engebanc 4,82/6,03), rural 0,70 (Eagle);
//  - R$/unitário pelo padrão: baixo = menor comparável, médio = média, alto = maior (igual ao
//    padrão construtivo das fotos, PR #184).

import type {
  Alerta, AvaliacaoTecnica, BenfeitoriaCalculo, CubRef, Edificacao, FatorAplicado, FatorRating, Homogeneizacao, NivelAlerta,
  PadraoNivel, RatingGarantia, Valores, ZonaImovel, Comparavel,
} from "./tipos";
import {
  FATOR_TOTAL_MAX, FATOR_TOTAL_MIN, cubDoPadrao, estadoDe, estatistica, fatorAreaAbunahman, grauFundamentacao, grauPrecisao,
  padraoDetalheDe, rossHeidecke, vidaUtil,
} from "./normas";

export const FATOR_OFERTA = 0.9;
/** Hipótese de rejeição da amostra: ±30% em torno da média (Eagle Consult). */
export const LIMITE_SANEAMENTO = 0.3;
export const FATOR_LIQUIDEZ: Record<ZonaImovel, number> = { URBANO: 0.8, RURAL: 0.7 };
/** Matrícula vale 30 dias (prática de cartório/financiamento; os laudos pedem o mesmo). */
export const VALIDADE_MATRICULA_DIAS = 30;

const pos = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const fmtNum = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b);

export function diasDesde(iso: string | null | undefined, hoje = new Date()) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((hoje.getTime() - d.getTime()) / 86400000);
}

type Base = Pick<AvaliacaoTecnica, "zona" | "areas" | "urbano" | "rural" | "mercado" | "laudo_externo"> & Partial<Pick<AvaliacaoTecnica, "terras">>;

/** Área usada no cálculo e de onde veio. */
function areaConsiderada(av: Base): { area: number | null; criterio: string } {
  const a = av.areas;
  if (av.zona === "RURAL") {
    if (pos(a.matricula_ha)) return { area: a.matricula_ha, criterio: "área da matrícula" };
    if (pos(a.geo_calculada_ha)) return { area: a.geo_calculada_ha, criterio: "área calculada pelo GEO" };
    if (pos(a.geo_declarada_ha)) return { area: a.geo_declarada_ha, criterio: "área do memorial GEO" };
    if (pos(a.ccir_ha)) return { area: a.ccir_ha, criterio: "área do CCIR" };
    if (pos(a.itr_ha)) return { area: a.itr_ha, criterio: "área do ITR" };
    if (pos(a.car_ha)) return { area: a.car_ha, criterio: "área do CAR" };
    return { area: null, criterio: "área não encontrada nos documentos" };
  }
  // Urbano: comparáveis são R$/m² de área construída (anúncios). Unidade em condomínio usa a
  // área privativa (os anúncios de apartamento informam a privativa). Terreno só se não há construção.
  if (pos(a.privativa_m2)) return { area: a.privativa_m2, criterio: "área privativa" };
  if (pos(a.construida_estimada_m2)) return { area: a.construida_estimada_m2, criterio: "área construída real (fotos/levantamento)" };
  if (pos(a.construida_iptu_m2)) return { area: a.construida_iptu_m2, criterio: "área construída do IPTU" };
  if (pos(a.construida_matricula_m2)) return { area: a.construida_matricula_m2, criterio: "área construída da matrícula" };
  if (av.urbano?.tipo && /terreno|lote/i.test(av.urbano.tipo)) {
    const t = a.terreno_matricula_m2 ?? a.terreno_iptu_m2;
    if (pos(t)) return { area: t, criterio: "área do terreno" };
  }
  return { area: null, criterio: "área construída não encontrada nos documentos" };
}

/**
 * Saneamento da amostra: descarta quem fica fora de ±30% do centro (mediana na 1ª passada,
 * depois a média dos aceitos) e recalcula até estabilizar. Se sobrarem menos de 3, fica com os 3 mais próximos da mediana.
 */
export function sanear(valores: number[]): boolean[] {
  const idx = valores.map((v, i) => (pos(v) ? i : -1)).filter((i) => i >= 0);
  // 1ª passada centrada na mediana (um anúncio fora da curva não arrasta a média);
  // depois recalcula pela média dos aceitos até estabilizar.
  const ordem = [...idx].sort((a, b) => valores[a] - valores[b]);
  const meio = ordem.length / 2;
  const mediana0 = ordem.length === 0 ? 0 : ordem.length % 2 ? valores[ordem[Math.floor(meio)]] : (valores[ordem[meio - 1]] + valores[ordem[meio]]) / 2;
  let aceitos = idx.filter((i) => Math.abs(valores[i] - mediana0) <= LIMITE_SANEAMENTO * mediana0);
  if (aceitos.length === 0) aceitos = idx;
  for (let k = 0; k < 6; k++) {
    const media = aceitos.reduce((s, i) => s + valores[i], 0) / Math.max(1, aceitos.length);
    const novos = idx.filter((i) => Math.abs(valores[i] - media) <= LIMITE_SANEAMENTO * media);
    if (novos.length === aceitos.length && novos.every((i, j) => i === aceitos[j])) break;
    aceitos = novos;
    if (aceitos.length === 0) break;
  }
  if (aceitos.length < 3 && idx.length >= 3) {
    const ord = [...idx].sort((a, b) => valores[a] - valores[b]);
    const mediana = valores[ord[Math.floor(ord.length / 2)]];
    aceitos = [...idx].sort((a, b) => Math.abs(valores[a] - mediana) - Math.abs(valores[b] - mediana)).slice(0, 3);
  } else if (aceitos.length === 0) {
    aceitos = idx;
  }
  const set = new Set(aceitos);
  return valores.map((_, i) => set.has(i));
}

/** Mínimo de comparáveis para a amostra ficar só no recorte do condomínio. */
const MIN_RECORTE = 3;
const mediaDe = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/**
 * Recorte por condomínio (urbano): casa/lote em condomínio fechado vale mais por m² que o de
 * rua, então misturar os dois distorce o valor. Ordem: mesmo condomínio → outros condomínios
 * → amostra mista (com alerta). Imóvel fora de condomínio usa só os de fora, se houver 3.
 */
function recorteCondominio(av: Base, comps: Comparavel[]): { mask: boolean[]; criterio: string | null } {
  const tudo = comps.map(() => true);
  const em = av.urbano?.condominio?.em_condominio;
  if (av.zona !== "URBANO" || typeof em !== "boolean" || comps.length === 0) return { mask: tudo, criterio: null };
  const conta = (m: boolean[]) => m.filter(Boolean).length;
  if (em) {
    const mesmo = comps.map((c) => c.mesmo_condominio === true);
    if (conta(mesmo) >= MIN_RECORTE) return { mask: mesmo, criterio: `só comparáveis do mesmo condomínio (${conta(mesmo)} de ${comps.length})` };
    const cond = comps.map((c) => c.em_condominio === true || c.mesmo_condominio === true);
    if (conta(cond) >= MIN_RECORTE) return { mask: cond, criterio: `só comparáveis em condomínio (${conta(cond)} de ${comps.length})` };
    return { mask: tudo, criterio: `amostra mista: só ${conta(cond)} comparável(is) em condomínio` };
  }
  const fora = comps.map((c) => c.em_condominio === false && c.mesmo_condominio !== true);
  if (conta(fora) >= MIN_RECORTE) return { mask: fora, criterio: `só comparáveis fora de condomínio (${conta(fora)} de ${comps.length})` };
  return { mask: tudo, criterio: null };
}

export function calcularValores(av: Base, padrao: PadraoNivel | null | undefined, extra?: { cub?: CubRef | null }): Valores {
  const unidade = av.zona === "RURAL" ? "ha" : "m2";
  const rural = av.zona === "RURAL";
  const { area, criterio: areaCriterio } = areaConsiderada(av);
  const comps: Comparavel[] = av.mercado?.comparaveis ?? [];
  const cub = extra?.cub ?? null;
  const recorte = recorteCondominio(av, comps);
  const fatorLiq = FATOR_LIQUIDEZ[av.zona];
  // Rural: região geoeconômica — com 5+ anúncios até 120 km, os mais distantes saem.
  const perto = comps.map((c) => typeof c.distancia_km === "number" && c.distancia_km <= RAIO_REGIAO_KM);
  const usarRaio = rural && perto.filter(Boolean).length >= 5;

  // ── Homogeneização (tratamento por fatores, como nos laudos de referência) ──
  const iaAval = av.terras?.indice_agronomico ?? null;
  const edificio = !rural && /apart|sala|flat|studio|kitnet|cobertura/i.test(av.urbano?.tipo ?? "");
  const padraoAval = padraoDetalheDe(av.urbano?.padrao_detalhe ?? av.urbano?.padrao ?? padrao);
  const vidaAval = vidaUtil(av.urbano?.tipo);
  const focAval = rossHeidecke(av.urbano?.idade_aparente_anos ?? null, vidaAval, estadoDe(av.urbano?.conservacao));
  const cubAval = padraoAval ? cubDoPadrao(cub?.valores, padraoAval, edificio) : null;
  const avisos: string[] = [];

  const homog: (Homogeneizacao | null)[] = comps.map((c, i) => {
    if (!pos(c.valor) || !pos(c.area)) return null;
    // Anúncio → negócio (fator oferta) e, no rural, sem as benfeitorias (avaliadas à parte).
    const benf = rural && pos(c.benfeitorias_valor) ? c.benfeitorias_valor : 0;
    const vuBruto = (c.valor * FATOR_OFERTA - benf) / c.area;
    const fatores: FatorAplicado[] = [];
    if (rural) {
      if (pos(iaAval) && pos(c.indice_agronomico)) fatores.push({ sigla: "Fcs", nome: "Classe de capacidade de uso e situação", valor: arred(iaAval / c.indice_agronomico) });
    } else {
      const cubComp = c.padrao_detalhe ? cubDoPadrao(cub?.valores, c.padrao_detalhe, edificio) : null;
      if (pos(cubAval) && pos(cubComp)) fatores.push({ sigla: "Fpc", nome: "Padrão construtivo (relação dos CUBs)", valor: arred(cubAval / cubComp) });
      if (pos(c.indice_local)) fatores.push({ sigla: "Ftr", nome: "Transposição (localização)", valor: arred(100 / c.indice_local) });
      const temIdade = typeof c.idade === "number" || !!c.estado;
      const focComp = temIdade ? rossHeidecke(c.idade ?? null, vidaAval, c.estado ?? null) : null;
      if (pos(focComp) && pos(focAval)) fatores.push({ sigla: "Foc", nome: "Obsolescência e conservação (Ross-Heidecke)", valor: arred(focAval / focComp) });
      if (pos(area)) fatores.push({ sigla: "Fa", nome: "Área (Abunahman)", valor: fatorAreaAbunahman(c.area, area) });
    }
    const total = arred(fatores.reduce((p, f) => p * f.valor, 1));
    let motivo: string | null = null;
    if (!recorte.mask[i]) motivo = "fora do recorte de condomínio";
    else if (usarRaio && !perto[i]) motivo = `fora da região geoeconômica (${typeof c.distancia_km === "number" ? `~${Math.round(c.distancia_km)} km` : "distância não informada"})`;
    else if (!(vuBruto > 0)) motivo = "benfeitorias maiores que o preço";
    else if (total < FATOR_TOTAL_MIN || total > FATOR_TOTAL_MAX) motivo = `fator total ${total.toFixed(2)} fora de ${FATOR_TOTAL_MIN.toFixed(2)}–${FATOR_TOTAL_MAX.toFixed(2)} (pouco semelhante)`;
    return { vu_bruto: vuBruto, fatores, fator_total: total, vu_homogeneizado: vuBruto * total, usado: motivo === null, motivo };
  });
  if (rural && !pos(iaAval)) avisos.push("índice agronômico do imóvel não definido: terras não homogeneizadas por classe e situação");
  if (!rural && !pos(cubAval)) avisos.push("CUB por padrão não localizado: padrão construtivo não homogeneizado");

  const todos = homog.map((h) => (h && h.usado ? h.vu_homogeneizado : 0));
  const saneados = sanear(todos);
  const precos = todos.filter((v, i) => saneados[i] && pos(v));
  const brutoCond = (cond: boolean) => homog
    .map((h, i) => (h && pos(h.vu_bruto) && (cond ? comps[i].em_condominio === true || comps[i].mesmo_condominio === true : comps[i].em_condominio === false) ? h.vu_bruto : 0))
    .filter(pos);
  const emCond = brutoCond(true);
  const foraCond = brutoCond(false);
  const premio = !rural && emCond.length >= 2 && foraCond.length >= 2 ? mediaDe(emCond) / mediaDe(foraCond) - 1 : null;

  // ── Benfeitorias do rural: custo de reprodução (CUB) × Ross-Heidecke ──
  const benfeitorias = rural ? custoBenfeitorias(av.rural?.edificacoes ?? [], cub) : [];
  if (rural && (av.rural?.edificacoes ?? []).some((e) => pos(e.area_m2)) && benfeitorias.length === 0) avisos.push("CUB/SINAPI não localizado: benfeitorias não avaliadas");
  const valorBenf = benfeitorias.reduce((s, b) => s + b.custo_depreciado, 0);

  const est = estatistica(precos, LIMITE_SANEAMENTO * 100);
  const fts = homog.filter((h, i): h is Homogeneizacao => !!h && h.usado && saneados[i]).map((h) => h.fator_total);
  const grauF = grauFundamentacao({
    n: precos.length,
    caracterizacaoCompleta: rural ? pos(iaAval) && pos(area) : pos(area) && !!padraoAval,
    dadosIdentificados: comps.length > 0 && comps.every((c) => !!c.fonte_url || !!c.fonte_nome),
    fatorMin: fts.length ? Math.min(...fts) : null,
    fatorMax: fts.length ? Math.max(...fts) : null,
  });

  const base: Valores = {
    unidade, area_considerada: area, area_criterio: areaCriterio,
    preco_unitario_min: null, preco_unitario_medio: null, preco_unitario_max: null, preco_unitario_aplicado: null,
    criterio: "sem comparáveis de mercado", fator_oferta: FATOR_OFERTA,
    saneados, amostra_total: todos.filter(pos).length, amostra_saneada: precos.length,
    no_recorte: recorte.mask, amostra_criterio: recorte.criterio, premio_condominio_pct: premio,
    metodo: `Comparativo direto de dados de mercado com tratamento por fatores (NBR 14653-${rural ? "3" : "2"})${rural ? " + custo de reprodução das benfeitorias" : ""}`,
    estatistica: est, grau_fundamentacao: precos.length ? grauF : null, grau_precisao: est ? grauPrecisao(est.amplitude_pct) : null,
    homog, cub, indice_agronomico: iaAval,
    valor_terra: null, valor_benfeitorias: rural ? valorBenf : null, benfeitorias,
    valor_mercado: null, fator_liquidez: fatorLiq, valor_liquidez: null,
    intervalo_inferior: null, intervalo_superior: null,
    valor_venal_iptu: av.urbano?.iptu?.valor_venal_total ?? null,
    vtn_itr: av.rural?.itr?.vtn_declarado ?? null,
    laudo_mercado: av.laudo_externo?.valor_mercado ?? null,
    laudo_garantia: av.laudo_externo?.valor_garantia ?? null,
  };
  if (precos.length === 0 || !est) return { ...base, criterio: ["sem comparáveis válidos", ...avisos].join(" · ") };
  const unit = est.media; // média saneada, como nos laudos de referência
  const terra = pos(area) ? unit * area : null;
  const extraBenf = rural ? valorBenf : 0;
  const vm = terra !== null ? terra + extraBenf : null;
  return {
    ...base,
    preco_unitario_min: Math.min(...precos), preco_unitario_medio: unit, preco_unitario_max: Math.max(...precos), preco_unitario_aplicado: unit,
    criterio: ["média saneada dos comparáveis homogeneizados", ...avisos].join(" · "),
    valor_terra: rural ? terra : null,
    valor_mercado: vm,
    valor_liquidez: vm !== null ? vm * fatorLiq : null,
    intervalo_inferior: pos(area) ? est.ic_inferior * area + extraBenf : null,
    intervalo_superior: pos(area) ? est.ic_superior * area + extraBenf : null,
  };
}

const arred = (v: number) => Math.round(v * 1000) / 1000;
/** Raio da região geoeconômica para anúncios rurais (km por estrada). */
const RAIO_REGIAO_KM = 120;

/** Custo de reprodução das benfeitorias rurais (como a Eagle): área × custo do m² × fator do tipo × Ross-Heidecke. */
export function custoBenfeitorias(eds: Edificacao[], cub: CubRef | null): BenfeitoriaCalculo[] {
  if (!cub) return [];
  // Base: CUB R1-N (casa padrão normal) do Sinduscon; sem ele, o custo médio SINAPI do IBGE.
  const baseM2 = pos(cub.valores["R1-N"]) ? cub.valores["R1-N"] : pos(cub.sinapi_m2) ? cub.sinapi_m2 : null;
  if (!pos(baseM2)) return [];
  const baseNome = pos(cub.valores["R1-N"]) ? "CUB R1-N" : "SINAPI";
  const out: BenfeitoriaCalculo[] = [];
  for (const e of eds) {
    if (!pos(e.area_m2)) continue;
    const padraoCub = baseNome;
    const cubM2 = baseM2;
    const fator = pos(e.fator_cub) ? Math.min(1.5, e.fator_cub) : 1;
    const vida = vidaUtil(e.nome);
    const estado = e.estado ?? estadoDe(e.conservacao) ?? "c";
    const idade = Math.max(0, e.idade_aparente_anos ?? 0);
    const coef = rossHeidecke(idade, vida, estado);
    const unitNovo = cubM2 * fator;
    out.push({
      nome: e.nome, area_m2: e.area_m2, padrao_cub: padraoCub, cub_m2: cubM2, fator_cub: fator, unitario_novo: unitNovo,
      idade, vida_util: vida, estado, coef_depreciacao: coef,
      custo_novo: unitNovo * e.area_m2, custo_depreciado: unitNovo * e.area_m2 * coef, averbada: e.averbada ?? null,
    });
  }
  return out;
}

const ONUS_CRITICO = /penhora|indisponib|arresto|sequestro|hipoteca|aliena[cç][aã]o fiduci|usufruto|bem de fam|cl[aá]usula de inalienab|a[cç][aã]o (real|reipersecut)/i;

/** Alertas fixos + os que a IA apontou (sem repetir título). */
export function gerarAlertas(av: Omit<AvaliacaoTecnica, "alertas" | "rating" | "parecer">, clienteNome?: string | null): Alerta[] {
  const out: Alerta[] = [];
  const add = (nivel: NivelAlerta, categoria: string, titulo: string, detalhe?: string | null) => out.push({ nivel, categoria, titulo, detalhe: detalhe ?? null });
  const tipos = new Set(av.arquivos.map((a) => a.tipo));
  const a = av.areas;

  // ── Documentação ──
  if (!tipos.has("MATRICULA") && !tipos.has("ESCRITURA")) add("CRITICO", "Documentação", "Matrícula do imóvel não encontrada nos documentos");
  const dias = diasDesde(av.identificacao.data_certidao);
  if (dias !== null && dias > VALIDADE_MATRICULA_DIAS) add("ATENCAO", "Documentação", `Matrícula emitida há ${dias} dias`, `Pedir certidão atualizada (validade usual de ${VALIDADE_MATRICULA_DIAS} dias).`);
  if (!tipos.has("FOTO")) add("ATENCAO", "Documentação", "Sem fotos do imóvel", "Sem fotos não há como conferir padrão, conservação e benfeitorias.");
  if (av.zona === "URBANO" && !tipos.has("IPTU") && !tipos.has("CND_IPTU")) add("ATENCAO", "Documentação", "IPTU não encontrado", "Sem IPTU não dá para conferir área construída cadastrada e valor venal.");
  if (av.zona === "RURAL") {
    if (!tipos.has("CCIR")) add("ATENCAO", "Documentação", "CCIR não encontrado");
    if (!tipos.has("ITR") && !tipos.has("CND_ITR")) add("ATENCAO", "Documentação", "ITR não encontrado");
    const carSicar = av.consultas?.find((c) => c.id === "CAR");
    if (!tipos.has("CAR")) {
      if (carSicar?.status === "ENCONTRADO") add("INFO", "Documentação", "CAR não anexado, mas localizado no SICAR pela poligonal", carSicar.itens?.[0] ?? carSicar.detalhe);
      else add("ATENCAO", "Documentação", "CAR não encontrado", carSicar?.status === "LIVRE" ? "Nenhum CAR cobre a poligonal no SICAR: imóvel possivelmente sem CAR." : "Sem CAR não há como verificar Reserva Legal e APP.");
    }
    if (!tipos.has("GEO_MEMORIAL") && !tipos.has("GEO_MAPA") && !tipos.has("GEO_KML")) add("ATENCAO", "GEO", "Georreferenciamento (GEO/SIGEF) não encontrado", "Exigido pela Lei 10.267/2001 conforme o tamanho da área — validar com Robson.");
  }

  // ── Registro ──
  // Averbação de estado civil, nome, construção ou condomínio não é ônus (a IA às vezes lista).
  const naoEhOnus = /casamento|pacto|div[oó]rcio|separa[cç][aã]o|[oó]bito|estado civil|altera[cç][aã]o de nome|constru[cç][aã]o|edifica|condom[ií]nio|conven[cç][aã]o|cancelamento|numera[cç][aã]o|cadastr/i;
  for (const o of av.registro.onus.filter((x) => x.ativo && !naoEhOnus.test(x.tipo))) {
    const critico = ONUS_CRITICO.test(`${o.tipo} ${o.descricao ?? ""}`);
    add(critico ? "CRITICO" : "ATENCAO", "Registro", `${o.tipo}${o.registro ? ` (${o.registro})` : ""} ativo na matrícula`, [o.favorecido ? `Em favor de ${o.favorecido}.` : null, o.descricao].filter(Boolean).join(" "));
  }
  if (clienteNome && (av.identificacao.proprietarios ?? []).length > 0) {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(ltda|me|eireli|s\/?a|epp)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const cli = norm(clienteNome).split(" ").filter((t) => t.length > 2);
    const bate = (av.identificacao.proprietarios ?? []).some((p) => {
      const pn = norm(p);
      return cli.length > 0 && cli.filter((t) => pn.includes(t)).length >= Math.min(2, cli.length);
    });
    // Imóvel de terceiro é permitido (garantidor ≠ proponente): só informa, não pesa no rating.
    if (!bate) add("INFO", "Registro", "Imóvel de terceiro garantidor", `Matrícula: ${(av.identificacao.proprietarios ?? []).join(", ")}. Proponente: ${clienteNome}. O proprietário assina como interveniente garantidor (com anuência do cônjuge, se casado).`);
  }

  // ── Áreas ──
  if (av.zona === "URBANO") {
    const real = a.construida_estimada_m2 ?? a.construida_iptu_m2 ?? a.privativa_m2;
    const averb = a.construida_matricula_m2;
    if (pos(real) && pos(averb) && real > averb * 1.1) {
      const dif = real - averb;
      add(dif / real > 0.3 ? "CRITICO" : "ATENCAO", "Áreas", `${fmtNum(dif, 0)} m² de construção sem averbação na matrícula (${Math.round((dif / real) * 100)}%)`, `Averbada: ${fmtNum(averb, 2)} m² · considerada: ${fmtNum(real, 2)} m². Exigir averbação ou descontar do valor.`);
    } else if (pos(real) && !pos(averb) && !(av.urbano?.tipo && /terreno|lote/i.test(av.urbano.tipo))) {
      add("ATENCAO", "Áreas", "Matrícula não informa a área construída", av.registro.construcao_averbada ? `Consta: "${av.registro.construcao_averbada}".` : "Conferir averbação da construção.");
    }
    if (pos(a.construida_iptu_m2) && pos(a.construida_estimada_m2) && pct(a.construida_iptu_m2, a.construida_estimada_m2) > 0.15) {
      add("ATENCAO", "Áreas", "Área construída do IPTU diverge da área real", `IPTU ${fmtNum(a.construida_iptu_m2, 2)} m² × real ${fmtNum(a.construida_estimada_m2, 2)} m².`);
    }
    if (pos(a.terreno_matricula_m2) && pos(a.terreno_iptu_m2) && pct(a.terreno_matricula_m2, a.terreno_iptu_m2) > 0.05) {
      add("ATENCAO", "Áreas", "Área do terreno diverge entre matrícula e IPTU", `Matrícula ${fmtNum(a.terreno_matricula_m2, 2)} m² × IPTU ${fmtNum(a.terreno_iptu_m2, 2)} m².`);
    }
  } else {
    const fontes: [string, number | null | undefined][] = [["CCIR", a.ccir_ha], ["ITR", a.itr_ha], ["CAR", a.car_ha], ["GEO (memorial)", a.geo_declarada_ha], ["GEO (calculada)", a.geo_calculada_ha]];
    if (pos(a.matricula_ha)) {
      for (const [nome, v] of fontes) {
        if (pos(v) && pct(a.matricula_ha, v) > 0.05) add(pct(a.matricula_ha, v) > 0.2 ? "CRITICO" : "ATENCAO", "Áreas", `Área do ${nome} diverge da matrícula`, `Matrícula ${fmtNum(a.matricula_ha, 4)} ha × ${nome} ${fmtNum(v, 4)} ha (${Math.round(pct(a.matricula_ha, v) * 100)}%).`);
      }
    }
    if (pos(a.geo_declarada_ha) && pos(a.geo_calculada_ha) && pct(a.geo_declarada_ha, a.geo_calculada_ha) > 0.02) {
      add("ATENCAO", "GEO", "Área calculada pelos vértices diverge da área escrita no memorial", `Memorial ${fmtNum(a.geo_declarada_ha, 4)} ha × calculada ${fmtNum(a.geo_calculada_ha, 4)} ha. Pode haver vértices faltando na leitura ou erro no memorial.`);
    }
  }

  // ── Rural: cadastros, GEO, ambiental ──
  if (av.zona === "RURAL" && av.rural) {
    const r = av.rural;
    if (r.geo) {
      if (r.geo.certificado === false) add("ATENCAO", "GEO", "Georreferenciamento sem certificação no SIGEF");
      if (r.geo.certificado && r.geo.averbado_na_matricula === false) add("ATENCAO", "GEO", "GEO certificado, mas não averbado na matrícula", "Averbar a certificação SIGEF no cartório.");
    }
    if ((tipos.has("GEO_MEMORIAL") || tipos.has("GEO_KML")) && !av.poligonal) add("ATENCAO", "GEO", "Não foi possível ler as coordenadas dos vértices do GEO", "Conferir se o memorial tem a tabela de vértices (ou anexar o KML).");
    if (av.poligonal?.municipio_centroide && av.identificacao.cidade) {
      const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
      if (n(av.poligonal.municipio_centroide) !== n(av.identificacao.cidade)) {
        add("ATENCAO", "GEO", "O centro da poligonal cai em outro município", `Centroide em ${av.poligonal.municipio_centroide}${av.poligonal.uf_centroide ? `/${av.poligonal.uf_centroide}` : ""}; matrícula indica ${av.identificacao.cidade}. Normal em área de divisa — conferir.`);
      }
    }
    if (r.ccir?.situacao && /pendente|n[aã]o quitad|vencid|em aberto/i.test(r.ccir.situacao)) add("ATENCAO", "Cadastros", `CCIR: ${r.ccir.situacao}`);
    const anoAtual = new Date().getFullYear();
    if (pos(r.itr?.exercicio) && r.itr!.exercicio! < anoAtual - 1) add("ATENCAO", "Cadastros", `ITR mais recente é de ${r.itr!.exercicio}`, "Pedir a declaração/CND do exercício atual.");
    if (r.car?.situacao && /pendente|cancelad|suspens/i.test(r.car.situacao)) add("ATENCAO", "Ambiental", `CAR: ${r.car.situacao}`);
    const areaRef = a.matricula_ha ?? a.car_ha;
    if (pos(r.car?.reserva_legal_ha) && pos(areaRef) && pos(r.reserva_legal_exigida_pct)) {
      const atual = (r.car!.reserva_legal_ha! / (a.car_ha ?? areaRef)) * 100;
      if (atual + 0.5 < r.reserva_legal_exigida_pct!) add("ATENCAO", "Ambiental", `Reserva Legal de ${fmtNum(atual, 1)}% (exigido ${r.reserva_legal_exigida_pct}%)`, "Possível passivo ambiental: compensação ou recomposição.");
    }
    if (r.servidao_passagem && /sem servid|n[aã]o (h[aá]|consta|registrad|averbad)/i.test(r.servidao_passagem) && !/n[aã]o se aplica|estrada (vicinal|municipal|estadual|p[uú]blica)|rodovia|via p[uú]blica/i.test(r.servidao_passagem)) add("ATENCAO", "Registro", "Acesso sem servidão de passagem registrada", r.servidao_passagem);
    const naoAverb = (r.edificacoes ?? []).filter((e) => e.averbada === false);
    if (naoAverb.length > 0) {
      const m2 = naoAverb.reduce((s, e) => s + (e.area_m2 ?? 0), 0);
      add("INFO", "Áreas", `${naoAverb.length} edificação(ões) não averbada(s)${m2 > 0 ? ` (${fmtNum(m2, 0)} m²)` : ""}`, "Benfeitorias não averbadas pesam menos na liquidez.");
    }
  }

  // ── Rural: consultas públicas pela poligonal ──
  for (const c of av.consultas ?? []) {
    if (c.status === "INDISPONIVEL") { add("INFO", "Ambiental", `Consulta indisponível: ${c.nome}`, c.detalhe); continue; }
    if (c.status !== "ENCONTRADO") continue;
    if (c.id === "CAR") {
      const itens = c.itens ?? [];
      if (itens.length > 1) add("ATENCAO", "Cadastros", `${itens.length} CARs ativos sobre a área (sobreposição)`, `${itens.slice(1, 4).join(" | ")}${itens.length > 4 ? ` | e mais ${itens.length - 4}` : ""}. Principal: ${itens[0]}.`);
      continue;
    }
    const nivel: NivelAlerta = c.gravidade === "CRITICO" || c.id === "TI" ? "CRITICO" : "ATENCAO";
    const titulo = c.id === "TI" ? "Área sobrepõe Terra Indígena" : c.id === "UC" ? "Área sobrepõe Unidade de Conservação" : c.id === "EMBARGO" ? (/sobre a área/.test(c.detalhe) ? "Embargo ambiental sobre a área" : "Proprietário com embargo ambiental em outro imóvel") : "Alerta de desmatamento (DETER) na área";
    add(nivel, "Ambiental", titulo, `${(c.itens ?? []).slice(0, 4).join(" | ")}. Fonte: ${c.fonte}.`);
  }
  if (av.zona === "RURAL" && av.poligonal && !av.consultas?.length) add("INFO", "Ambiental", "Consultas ambientais não realizadas");
  if (av.zona === "RURAL" && !av.poligonal) add("INFO", "Ambiental", "Sem poligonal: CAR, TI, UC, embargos e DETER não puderam ser consultados pela área");

  // ── Urbano: riscos e IPTU ──
  if (av.zona === "URBANO" && av.urbano) {
    for (const r of av.urbano.riscos ?? []) add("ATENCAO", "Riscos", r);
    if (av.urbano.iptu?.debitos && !/sem d[eé]bito|quitad|nada consta|negativ/i.test(av.urbano.iptu.debitos)) add("ATENCAO", "Documentação", "Débitos de IPTU", av.urbano.iptu.debitos);
  }

  // ── Mercado e valores ──
  const cond = av.urbano?.condominio;
  if (av.zona === "URBANO" && cond?.em_condominio && /amostra mista/.test(av.valores.amostra_criterio ?? "")) {
    add("ATENCAO", "Mercado", "Poucos comparáveis em condomínio: valor pode estar subavaliado", `O imóvel fica em condomínio${cond.nome ? ` (${cond.nome})` : ""}, mas a pesquisa achou menos de ${MIN_RECORTE} anúncios em condomínio; a amostra misturou imóveis de rua, que costumam ter R$/m² menor. Conferir com anúncios do próprio condomínio ou laudo.`);
  }
  if (!av.mercado || av.mercado.comparaveis.length === 0) add("ATENCAO", "Mercado", "Sem comparáveis de mercado: valor de mercado não calculado");
  else if (av.valores.amostra_saneada < 3) add("ATENCAO", "Mercado", `Só ${av.valores.amostra_saneada} comparável(is) válido(s) após o saneamento`, "Confiança baixa do valor; a NBR 14653 pede no mínimo 3 a 5 dados.");
  else if (av.valores.amostra_total - av.valores.amostra_saneada >= Math.ceil(av.valores.amostra_total / 2)) add("INFO", "Mercado", `Amostra dispersa: ${av.valores.amostra_total - av.valores.amostra_saneada} de ${av.valores.amostra_total} comparáveis descartados no saneamento`, "Preços muito espalhados na região; conferir com corretor local ou laudo.");
  if (av.valores.grau_precisao === "FORA") add("ATENCAO", "Mercado", `Amplitude do intervalo de confiança de ${fmtNum(av.valores.estatistica?.amplitude_pct ?? 0, 1)}% (acima de 50%)`, "Precisão abaixo do Grau I da NBR 14653: amostra muito dispersa, valor indicativo.");
  if (av.valores.grau_fundamentacao?.grau === "FORA") add("ATENCAO", "Mercado", "Amostra não atinge o Grau I de fundamentação", "Poucos dados ou fatores fora do intervalo admissível; buscar mais comparáveis ou laudo.");
  if (/CUB por padrão não localizado/.test(av.valores.criterio)) add("INFO", "Mercado", "CUB por padrão do estado não localizado", "O fator padrão construtivo não foi aplicado; os comparáveis foram buscados no mesmo padrão.");
  if (/CUB\/SINAPI não localizado/.test(av.valores.criterio)) add("INFO", "Mercado", "Custo de construção do estado não localizado", "Benfeitorias sem custo de reprodução: valor só da terra nua.");
  if (pos(av.valores.valor_mercado) && pos(av.valores.laudo_mercado) && pct(av.valores.valor_mercado, av.valores.laudo_mercado) > 0.2) {
    add("INFO", "Mercado", "Valor V3 difere mais de 20% do laudo anexado", `V3 ${fmtNum(av.valores.valor_mercado, 0)} × laudo ${fmtNum(av.valores.laudo_mercado, 0)}.`);
  }
  if (av.laudo_externo?.data_base) {
    const d = diasDesde(av.laudo_externo.data_base);
    if (d !== null && d > 180) add("ATENCAO", "Documentação", `Laudo anexado tem ${Math.floor(d / 30)} meses`, "Laudos valem 6 meses (prorrogáveis até 12).");
  }
  if (pos(av.valor_solicitado) && pos(av.valores.valor_liquidez)) {
    const ltv = av.valor_solicitado / av.valores.valor_liquidez;
    if (ltv > 0.7) add(ltv > 1 ? "CRITICO" : "ATENCAO", "Valores", `LTV de ${fmtNum(ltv * 100, 1)}% sobre o valor de liquidez`, "Acima do limite de 70%.");
  }

  // ── Alertas da IA (o que as regras não cobrem) ──
  return out;
}

/** Assuntos que as regras fixas já cobrem: alerta da IA sobre o mesmo assunto é descartado. */
const ASSUNTOS: [string, RegExp][] = [
  ["validade_matricula", /(matr[ií]cula|certid[aã]o).*(vencid|emitida h[aá]|desatualiz|validade)|(vencid|desatualiz).*(matr[ií]cula|certid[aã]o)/i],
  ["falta_car", /\bcar\b.*(n[aã]o|ausente|faltando|apresent)|(sem|aus[eê]ncia d[eo]) \bcar\b/i],
  ["falta_itr", /\bitr\b.*(n[aã]o (apresent|encontr)|ausente|faltando)|(sem|aus[eê]ncia d[eo]) \bitr\b/i],
  ["falta_ccir", /\bccir\b.*(n[aã]o (apresent|encontr)|ausente|faltando)/i],
  ["falta_fotos", /fotos?.*(n[aã]o|ausente|sem|faltando)|(sem|aus[eê]ncia de) fotos?/i],
  ["falta_iptu", /iptu.*(n[aã]o (apresent|encontr)|ausente|faltando)/i],
  ["proprietario", /propriet[aá]ri.*(difere|diferente|diverg|n[aã]o [eé] o (cliente|proponente))|terceiro garantidor|interveniente/i],
  ["geo_averbacao", /(geo|sigef|georref).*(n[aã]o averbad|sem averba|sem confirma|n[aã]o registrad)|averba.*(geo|sigef|georref)/i],
  ["servidao", /servid[aã]o de passagem/i],
  ["construcao_averbada", /(constru[cç]|edifica|benfeitor).*(n[aã]o averbad|sem averba)/i],
  ["ltv", /\bltv\b/i],
  ["debito_iptu", /iptu.*(aberto|vencid|d[eé]bito|atraso|n[aã]o pag|quita)/i],
];
export const assuntoDe = (a: Alerta) => ASSUNTOS.find(([, re]) => re.test(`${a.titulo} ${a.detalhe ?? ""}`.slice(0, 160)))?.[0] ?? null;

export function juntarAlertas(fixos: Alerta[], daIa: Alerta[]): Alerta[] {
  const vistos = new Set(fixos.map((x) => x.titulo.toLowerCase()));
  const assuntos = new Set(fixos.map(assuntoDe).filter(Boolean));
  const extras = daIa.filter((x) => {
    if (!x.titulo || vistos.has(x.titulo.toLowerCase())) return false;
    const a = assuntoDe(x);
    if (a && assuntos.has(a)) return false;
    if (a) assuntos.add(a);
    return true;
  });
  const ordem: Record<NivelAlerta, number> = { CRITICO: 0, ATENCAO: 1, INFO: 2 };
  return [...fixos, ...extras].sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

const CATEGORIAS_RATING: { categoria: string; max: number; inclui: string[] }[] = [
  { categoria: "Documentação", max: 20, inclui: ["Documentação"] },
  { categoria: "Registro", max: 25, inclui: ["Registro"] },
  { categoria: "Áreas e GEO", max: 20, inclui: ["Áreas", "GEO"] },
  { categoria: "Ambiental e riscos", max: 15, inclui: ["Ambiental", "Riscos", "Cadastros"] },
  { categoria: "Mercado e liquidez", max: 20, inclui: ["Mercado", "Valores"] },
];
const PESO: Record<NivelAlerta, number> = { CRITICO: 10, ATENCAO: 4, INFO: 0 };

/** Rating da Garantia V3: 100 pontos em 5 categorias; cada alerta tira pontos da sua categoria. */
export function calcularRating(alertas: Alerta[]): RatingGarantia {
  const fatores: FatorRating[] = CATEGORIAS_RATING.map(({ categoria, max, inclui }) => {
    const perda = alertas.filter((x) => inclui.includes(x.categoria)).reduce((s, x) => s + PESO[x.nivel], 0);
    return { categoria, max, pontos: Math.max(0, max - perda) };
  });
  // Alerta de categoria fora da tabela pesa em "Ambiental e riscos".
  const conhecidas = new Set(CATEGORIAS_RATING.flatMap((c) => c.inclui));
  const resto = alertas.filter((x) => !conhecidas.has(x.categoria)).reduce((s, x) => s + PESO[x.nivel], 0);
  if (resto > 0) fatores[3].pontos = Math.max(0, fatores[3].pontos - resto);
  let pontos = fatores.reduce((s, f) => s + f.pontos, 0);
  // Um crítico em registro (penhora, indisponibilidade…) limita a nota a D.
  if (alertas.some((x) => x.nivel === "CRITICO" && x.categoria === "Registro")) pontos = Math.min(pontos, 54);
  const nota = pontos >= 85 ? "A" : pontos >= 70 ? "B" : pontos >= 55 ? "C" : pontos >= 40 ? "D" : "E";
  return { nota, pontos, fatores };
}

// Análise Estruturada V3 — motor de cálculo (MELHORIA DA CONSULTA, Fase 1 / entrega 3).
// Funções puras: recebem os dados lidos (e conferidos pela Mesa) e devolvem indicadores,
// capacidade de pagamento, teste de estresse, validação cruzada e raio-X de custos.
// Nenhum número aqui vem da IA: tudo é fórmula fixa sobre o que foi extraído dos documentos.

import type { PerfilAnalise } from "@/lib/analise-estruturada/checklist";

// ── Premissas (calibrar com a Mesa) ─────────────────────────────────────────
export const PREMISSAS = {
  icsdPiso: 1.3,                 // cobertura mínima usada em CRI/CRA/FIDC
  taxaReferenciaMensal: 0.018,   // taxa para converter parcela em crédito máximo
  prazosMeses: [12, 24, 36, 60],
  comprometimentoPF: 0.3,        // parcela máxima sobre a renda líquida (PF)
  estresseQuedaReceita: 0.2,     // receita −20%
  estresseJurosAnual: 0.03,      // juros +3 p.p. ao ano sobre o saldo devedor
  estressePrazoRecebimentoDias: 30,
  coberturaExtratosMinima: 0.8,  // extratos devem mostrar ≥ 80% do faturamento
  divergenciaFiscalMaxima: 0.1,  // DRE × declaração fiscal
  entradasRelacionadasMaxima: 0.15,
  conversaoCaixaMinima: 0.6,     // fluxo dos extratos ÷ EBITDA
} as const;

export interface LeituraParaCalculo {
  item: string;
  tipo: string;
  arquivo: string;
  status: string;
  dados: Record<string, unknown> | null;
}

type Num = number | null;
const num = (v: unknown): Num => (typeof v === "number" && Number.isFinite(v) ? v : null);
const div = (a: Num, b: Num): Num => (a == null || b == null || b === 0 ? null : a / b);
const soma = (...xs: Num[]): Num => (xs.every((x) => x == null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0));
const r2 = (v: Num): Num => (v == null ? null : Math.round(v * 100) / 100);
const r4 = (v: Num): Num => (v == null ? null : Math.round(v * 10000) / 10000);
const media = (xs: number[]): Num => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const abs = (v: Num): Num => (v == null ? null : Math.abs(v));

export interface Alerta { nivel: "alto" | "medio" | "info"; tema: string; texto: string }

// ── Demonstrativos ──────────────────────────────────────────────────────────
interface Exercicio { periodo?: string; data_base?: string | null; balanco?: Record<string, unknown>; dre?: Record<string, unknown> }

function ehParcial(ex: Exercicio): boolean {
  const p = (ex.periodo ?? "").toLowerCase();
  return /balancete|parcial|[a-z]{3}\s*[-/a]\s*[a-z]{3}|\d{2}\/\d{4}/.test(p);
}

export function indicadoresExercicio(ex: Exercicio) {
  const b = ex.balanco ?? {}; const d = ex.dre ?? {};
  const g = (o: Record<string, unknown>, k: string) => num(o[k]);
  const receitaLiquida = g(d, "receita_liquida") ?? g(d, "receita_bruta");
  const custo = abs(g(d, "custo_vendas"));
  const lucroBruto = g(d, "lucro_bruto") ?? (receitaLiquida != null && custo != null ? receitaLiquida - custo : null);
  const deprec = abs(g(d, "depreciacao_amortizacao")) ?? 0;
  const despFin = abs(g(d, "despesas_financeiras"));
  const recFin = abs(g(d, "receitas_financeiras")) ?? 0;
  const lair = g(d, "lucro_antes_ir");
  const ebitda = lair != null
    ? lair + (despFin ?? 0) - recFin + deprec
    : lucroBruto != null && g(d, "despesas_operacionais") != null
      ? lucroBruto - Math.abs(g(d, "despesas_operacionais")!) + deprec
      : null;
  const lucroLiquido = g(d, "lucro_liquido");

  const ac = g(b, "ativo_circulante"), pc = g(b, "passivo_circulante"), pnc = g(b, "passivo_nao_circulante");
  const at = g(b, "ativo_total"), anc = g(b, "ativo_nao_circulante"), pl = g(b, "patrimonio_liquido");
  const caixa = g(b, "caixa_equivalentes"), receber = g(b, "contas_receber"), estoques = g(b, "estoques");
  const fornecedores = g(b, "fornecedores"), fiscais = g(b, "obrigacoes_fiscais_cp"), trabalhistas = g(b, "obrigacoes_trabalhistas_cp");
  const dividaBancaria = soma(g(b, "emprestimos_cp"), g(b, "emprestimos_lp"));
  const dividaLiquida = dividaBancaria != null ? dividaBancaria - (caixa ?? 0) : null;
  const custoBase = custo ?? (receitaLiquida != null && lucroBruto != null ? receitaLiquida - lucroBruto : null);

  const ncg = soma(receber, estoques) != null ? (soma(receber, estoques) ?? 0) - (soma(fornecedores, fiscais, trabalhistas) ?? 0) : null;
  const cdg = pl != null && anc != null ? pl + (pnc ?? 0) - anc : null;

  const pmr = div(receber, receitaLiquida), pme = div(estoques, custoBase), pmp = div(fornecedores, custoBase);
  return {
    periodo: ex.periodo ?? null,
    parcial: ehParcial(ex),
    receitaLiquida: r2(receitaLiquida),
    lucroBruto: r2(lucroBruto),
    ebitda: r2(ebitda),
    lucroLiquido: r2(lucroLiquido),
    margemBruta: r4(div(lucroBruto, receitaLiquida)),
    margemEbitda: r4(div(ebitda, receitaLiquida)),
    margemLiquida: r4(div(lucroLiquido, receitaLiquida)),
    liquidezCorrente: r2(div(ac, pc)),
    liquidezSeca: r2(ac != null ? div(ac - (estoques ?? 0), pc) : null),
    liquidezImediata: r2(div(caixa, pc)),
    endividamentoGeral: r4(div(soma(pc, pnc), at)),
    composicaoCurtoPrazo: r4(div(pc, soma(pc, pnc))),
    dividaBancaria: r2(dividaBancaria),
    dividaLiquida: r2(dividaLiquida),
    dividaLiquidaEbitda: r2(div(dividaLiquida, ebitda)),
    ebitdaDespesaFinanceira: r2(div(ebitda, despFin)),
    patrimonioLiquido: r2(pl),
    tributosARecolher: r2(fiscais),
    prazoRecebimentoDias: pmr != null ? Math.round(pmr * 360) : null,
    prazoEstoqueDias: pme != null ? Math.round(pme * 360) : null,
    prazoPagamentoDias: pmp != null ? Math.round(pmp * 360) : null,
    cicloFinanceiroDias: pmr != null ? Math.round((pmr + (pme ?? 0) - (pmp ?? 0)) * 360) : null,
    ncg: r2(ncg), cdg: r2(cdg), saldoTesouraria: r2(cdg != null && ncg != null ? cdg - ncg : null),
  };
}

// ── Faturamento ─────────────────────────────────────────────────────────────
function analisarFaturamento(dados: Record<string, unknown> | null) {
  const meses = ((dados?.meses as Array<{ mes?: string; valor?: number }>) ?? [])
    .filter((m) => m.mes && num(m.valor) != null)
    .sort((a, b) => a.mes!.localeCompare(b.mes!))
    .slice(-12);
  if (!meses.length) return null;
  const valores = meses.map((m) => m.valor!);
  const ult3 = media(valores.slice(-3)), ant3 = media(valores.slice(-6, -3));
  let quedas = 0, maxQuedas = 0;
  for (let i = 1; i < valores.length; i++) { quedas = valores[i] < valores[i - 1] ? quedas + 1 : 0; maxQuedas = Math.max(maxQuedas, quedas); }
  const m = media(valores)!;
  const desvio = Math.sqrt(media(valores.map((v) => (v - m) ** 2))!);
  return {
    meses: meses.map((x) => ({ mes: x.mes!, valor: x.valor! })),
    total: r2(valores.reduce((s, v) => s + v, 0)),
    mediaMensal: r2(m),
    tendencia3m: r4(ult3 != null && ant3 ? ult3 / ant3 - 1 : null),
    maiorSequenciaQuedas: maxQuedas,
    sazonalidade: r4(m ? desvio / m : null),
  };
}

// ── Extratos ────────────────────────────────────────────────────────────────
interface MesExtrato { mes?: string; entradas?: number; saidas?: number }
interface Cobranca { data?: string; descricao?: string; valor?: number }

function agregarExtratos(extratos: Record<string, unknown>[]) {
  const porMes = new Map<string, { entradas: number; saidas: number; parcelas: number }>();
  let relacionadas = 0;
  for (const e of extratos) {
    for (const m of (e.meses as MesExtrato[]) ?? []) {
      if (!m.mes) continue;
      const x = porMes.get(m.mes) ?? { entradas: 0, saidas: 0, parcelas: 0 };
      x.entradas += num(m.entradas) ?? 0; x.saidas += Math.abs(num(m.saidas) ?? 0);
      porMes.set(m.mes, x);
    }
    for (const p of (e.parcelas_dividas as Cobranca[]) ?? []) {
      if (!p.data || num(p.valor) == null) continue;
      const mes = p.data.slice(0, 7);
      const x = porMes.get(mes) ?? { entradas: 0, saidas: 0, parcelas: 0 };
      x.parcelas += Math.abs(p.valor!);
      porMes.set(mes, x);
    }
    relacionadas += num(e.entradas_mesma_titularidade) ?? 0;
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }));
  if (!meses.length) return null;
  const entradasTot = meses.reduce((s, m) => s + m.entradas, 0);
  return {
    meses: meses.map((m) => ({ mes: m.mes, entradas: r2(m.entradas)!, saidas: r2(m.saidas)!, parcelas: r2(m.parcelas)! })),
    entradasMediaMensal: r2(media(meses.map((m) => m.entradas))),
    // fluxo operacional: entradas − saídas, devolvendo as parcelas de dívida (o serviço da dívida é tratado à parte)
    fluxoOperacionalMedioMensal: r2(media(meses.map((m) => m.entradas - m.saidas + m.parcelas))),
    parcelasMediaMensal: r2(media(meses.map((m) => m.parcelas))),
    percentualEntradasRelacionadas: r4(entradasTot ? relacionadas / entradasTot : null),
  };
}

// ── Raio-X de custos bancários ──────────────────────────────────────────────
export const CATEGORIAS_CUSTO: Array<{ id: string; nome: string; palavras: string[]; acao: string; potencialEconomia: number }> = [
  { id: "seguros", nome: "Seguros", palavras: ["SEGURO", "SEG ", "PRESTAMISTA", "PROTECAO", "PROTEÇÃO", "PPI"], acao: "Conferir se foi contratado com autorização; cancelar o que não é obrigatório; cotar fora do banco. Seguro exigido junto com empréstimo: verificar.", potencialEconomia: 0.5 },
  { id: "capitalizacao", nome: "Capitalização e consórcio", palavras: ["CAPITALIZ", "CAP ", "CONSORCIO", "CONSÓRCIO"], acao: "Avaliar resgate ou desistência; normalmente rende abaixo da inflação.", potencialEconomia: 0.8 },
  { id: "juros", nome: "Juros e encargos", palavras: ["JUROS", "IOF", "MULTA", "ENCARGO", "MORA", "CHEQUE ESPECIAL", "LIMITE"], acao: "Trocar a dívida cara de curto prazo (cheque especial, conta garantida) por capital de giro mais barato.", potencialEconomia: 0.6 },
  { id: "cartao_maquininha", nome: "Cartão e maquininha", palavras: ["ANUIDADE", "ALUGUEL MAQ", "ALUG MAQ", "MAQUININHA", "POS ", "ANTECIP"], acao: "Renegociar taxas; devolver máquinas paradas; desligar a antecipação automática.", potencialEconomia: 0.4 },
  { id: "tarifas_conta", nome: "Tarifas de conta", palavras: ["CESTA", "PACOTE", "MANUT", "MENSALIDADE CONTA", "TAR CONTA", "CADASTRO", "EXTRATO"], acao: "Negociar pacote menor ou isenção; encerrar contas sem uso. Pessoa física: conta de serviços essenciais gratuitos.", potencialEconomia: 0.5 },
  { id: "tarifas_transacao", nome: "Tarifas por transação", palavras: ["TED", "DOC", "PIX", "SAQUE", "BOLETO", "COBRANCA", "COBRANÇA", "LIQUIDACAO", "LIQUIDAÇÃO", "TARIFA", "TAR "], acao: "Renegociar por volume; levar a cobrança para o banco mais barato.", potencialEconomia: 0.3 },
  { id: "servicos", nome: "Serviços recorrentes", palavras: ["ASSINATURA", "DEB AUT", "DEBITO AUTOMATICO", "DÉBITO AUTOMÁTICO", "MENSALIDADE"], acao: "Cancelar o que não é usado; contestar débito não reconhecido.", potencialEconomia: 0.5 },
];

function categoria(descricao: string) {
  const d = ` ${descricao.toUpperCase()} `;
  return CATEGORIAS_CUSTO.find((c) => c.palavras.some((p) => d.includes(p))) ?? null;
}

function raioX(extratos: Array<{ banco: string | null; dados: Record<string, unknown> }>) {
  const linhas: Array<{ data: string; descricao: string; valor: number; banco: string | null; categoria: string; mes: string }> = [];
  const mesesCobertos = new Set<string>();
  for (const e of extratos) {
    for (const m of (e.dados.meses as MesExtrato[]) ?? []) if (m.mes) mesesCobertos.add(m.mes);
    for (const c of (e.dados.cobrancas as Cobranca[]) ?? []) {
      if (!c.descricao || num(c.valor) == null || !c.data) continue;
      const cat = categoria(c.descricao);
      linhas.push({ data: c.data, descricao: c.descricao, valor: Math.abs(c.valor!), banco: e.banco, categoria: cat?.id ?? "outros", mes: c.data.slice(0, 7) });
    }
  }
  if (!linhas.length) return null;
  const nMeses = Math.max(mesesCobertos.size, new Set(linhas.map((l) => l.mes)).size, 1);

  const categorias = [...CATEGORIAS_CUSTO, { id: "outros", nome: "Outras cobranças", palavras: [], acao: "Conferir com o gerente o que é cada cobrança.", potencialEconomia: 0.3 }]
    .map((c) => {
      const ls = linhas.filter((l) => l.categoria === c.id);
      if (!ls.length) return null;
      const totalPeriodo = ls.reduce((s, l) => s + l.valor, 0);
      const anual = (totalPeriodo / nMeses) * 12;
      return {
        id: c.id, nome: c.nome, acao: c.acao,
        lancamentos: ls.length,
        totalPeriodo: r2(totalPeriodo)!, mediaMensal: r2(totalPeriodo / nMeses)!, projecaoAnual: r2(anual)!,
        economiaAnualEstimada: r2(anual * c.potencialEconomia)!,
        bancos: [...new Set(ls.map((l) => l.banco).filter(Boolean))] as string[],
      };
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => b.projecaoAnual - a.projecaoAnual);

  // recorrência por descrição normalizada (sem números) e aumentos de valor
  const norm = (s: string) => s.toUpperCase().replace(/[\d/.,:-]+/g, " ").replace(/\s+/g, " ").trim();
  const grupos = new Map<string, typeof linhas>();
  for (const l of linhas) { const k = `${norm(l.descricao)}|${l.banco ?? ""}`; grupos.set(k, [...(grupos.get(k) ?? []), l]); }
  const recorrentes = [...grupos.values()]
    .filter((g) => new Set(g.map((l) => l.mes)).size >= 2)
    .map((g) => {
      const ord = [...g].sort((a, b) => a.data.localeCompare(b.data));
      const primeiro = ord[0].valor, ultimo = ord[ord.length - 1].valor;
      return {
        descricao: ord[ord.length - 1].descricao, banco: ord[0].banco, ocorrencias: g.length,
        valorAtual: r2(ultimo)!, aumentou: ultimo > primeiro * 1.05,
      };
    })
    .sort((a, b) => b.valorAtual * b.ocorrencias - a.valorAtual * a.ocorrencias);

  const pacotes = linhas.filter((l) => l.categoria === "tarifas_conta");
  const bancosComPacote = [...new Set(pacotes.map((l) => l.banco).filter(Boolean))];

  return {
    mesesAnalisados: nMeses,
    totalPeriodo: r2(linhas.reduce((s, l) => s + l.valor, 0))!,
    projecaoAnual: r2(categorias.reduce((s, c) => s + c.projecaoAnual, 0))!,
    economiaAnualEstimada: r2(categorias.reduce((s, c) => s + c.economiaAnualEstimada, 0))!,
    categorias,
    recorrentes: recorrentes.slice(0, 30),
    pacoteEmMaisDeUmBanco: bancosComPacote.length > 1 ? bancosComPacote as string[] : [],
    lancamentos: linhas.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 300),
  };
}

// ── Crédito máximo ──────────────────────────────────────────────────────────
export function creditoMaximo(parcela: number, taxaMensal: number, prazo: number): number {
  if (parcela <= 0) return 0;
  return Math.round(parcela * (1 - (1 + taxaMensal) ** -prazo) / taxaMensal);
}
const tabelaCredito = (parcela: Num) =>
  PREMISSAS.prazosMeses.map((prazo) => ({ prazoMeses: prazo, creditoMaximo: parcela != null && parcela > 0 ? creditoMaximo(parcela, PREMISSAS.taxaReferenciaMensal, prazo) : 0 }));

// ── Cálculo completo ────────────────────────────────────────────────────────
export function calcular(perfil: PerfilAnalise, leituras: LeituraParaCalculo[]) {
  const lidas = leituras.filter((l) => l.status === "lido" && l.dados);
  const doTipo = (tipo: string, itens?: string[]) => lidas.filter((l) => l.tipo === tipo && (!itens || itens.includes(l.item)));
  const alertas: Alerta[] = [];
  const add = (nivel: Alerta["nivel"], tema: string, texto: string) => alertas.push({ nivel, tema, texto });
  const pct = (v: Num) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
  const brl = (v: Num) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));

  // demonstrativos (todos os exercícios de todos os arquivos)
  const exercicios = doTipo("demonstrativos").flatMap((l) => ((l.dados!.exercicios as Exercicio[]) ?? []));
  const indicadores = exercicios.map(indicadoresExercicio)
    .sort((a, b) => (a.periodo ?? "").localeCompare(b.periodo ?? ""));
  const anuais = indicadores.filter((i) => !i.parcial && i.receitaLiquida != null);
  const ultimo = anuais[anuais.length - 1] ?? null;
  const anterior = anuais[anuais.length - 2] ?? null;
  const crescimentoReceita = r4(ultimo && anterior && anterior.receitaLiquida ? ultimo.receitaLiquida! / anterior.receitaLiquida - 1 : null);

  const faturamento = analisarFaturamento(doTipo("faturamento")[0]?.dados ?? null);
  const itensExtratoTitular = perfil === "PJ" ? ["extratos_pj"] : ["extratos_pf"];
  const extratosTitular = doTipo("extrato", itensExtratoTitular);
  const extratos = agregarExtratos(extratosTitular.map((l) => l.dados!));
  const fiscal = doTipo("fiscal")[0]?.dados ?? null;
  const endividamento = doTipo("endividamento")[0]?.dados ?? null;

  // ── capacidade de pagamento ──
  const parcelasDeclaradas = num(endividamento?.total_parcelas_mensais) ??
    (((endividamento?.dividas as Array<{ parcela_mensal?: number }>) ?? []).reduce<Num>((s, d) => (num(d.parcela_mensal) != null ? (s ?? 0) + d.parcela_mensal! : s), null));
  const servicoDivida = parcelasDeclaradas ?? extratos?.parcelasMediaMensal ?? null;
  const fonteServico = parcelasDeclaradas != null ? "relação de endividamento" : extratos?.parcelasMediaMensal != null ? "parcelas identificadas nos extratos" : null;
  const saldoDevedor = num(endividamento?.total_saldo_devedor) ?? ultimo?.dividaBancaria ?? null;

  let capacidade: Record<string, unknown>;
  if (perfil === "PJ") {
    const ebitdaMensal = ultimo?.ebitda != null ? ultimo.ebitda / 12 : null;
    const fluxoExtratos = extratos?.fluxoOperacionalMedioMensal ?? null;
    const candidatos = [ebitdaMensal, fluxoExtratos].filter((x): x is number => x != null);
    const caixa = candidatos.length ? Math.min(...candidatos) : null;
    const fonteCaixa = caixa == null ? null : caixa === ebitdaMensal ? "EBITDA mensal (DRE)" : "fluxo operacional médio dos extratos";
    const icsd = div(caixa, servicoDivida);
    const parcelaMax = caixa != null ? caixa / PREMISSAS.icsdPiso - (servicoDivida ?? 0) : null;

    const receitaMensal = faturamento?.mediaMensal ?? (ultimo?.receitaLiquida != null ? ultimo.receitaLiquida / 12 : null);
    const margemBruta = ultimo?.margemBruta ?? null;
    const caixaQuedaReceita = caixa != null && receitaMensal != null
      ? caixa - receitaMensal * PREMISSAS.estresseQuedaReceita * (margemBruta ?? 1) : null;
    const servicoJurosAltos = servicoDivida != null ? servicoDivida + (saldoDevedor ?? 0) * PREMISSAS.estresseJurosAnual / 12 : null;
    const estresse = [
      { cenario: "Receita 20% menor", caixaMensal: r2(caixaQuedaReceita), icsd: r2(div(caixaQuedaReceita, servicoDivida)) },
      { cenario: "Juros 3 p.p. maiores", caixaMensal: r2(caixa), icsd: r2(div(caixa, servicoJurosAltos)) },
      { cenario: "Os dois juntos", caixaMensal: r2(caixaQuedaReceita), icsd: r2(div(caixaQuedaReceita, servicoJurosAltos)) },
    ];
    const capitalGiroPrazo = receitaMensal != null ? r2((receitaMensal / 30) * PREMISSAS.estressePrazoRecebimentoDias) : null;

    capacidade = {
      caixaMensal: r2(caixa), fonteCaixa, ebitdaMensal: r2(ebitdaMensal), fluxoExtratosMensal: fluxoExtratos,
      conversaoCaixa: r4(div(fluxoExtratos, ebitdaMensal)),
      servicoDividaMensal: r2(servicoDivida), fonteServico, saldoDevedor: r2(saldoDevedor),
      icsdAtual: r2(icsd), parcelaMaximaNova: r2(parcelaMax != null ? Math.max(parcelaMax, 0) : null),
      creditoMaximo: tabelaCredito(parcelaMax),
      estresse, capitalGiroPrazoMais30Dias: capitalGiroPrazo,
    };

    if (caixa == null) add("alto", "Capacidade", "Não foi possível calcular a geração de caixa: faltam DRE com EBITDA ou extratos lidos.");
    if (icsd != null && icsd < 1) add("alto", "Capacidade", `ICSD atual de ${icsd.toFixed(2).replace(".", ",")}: o caixa não cobre as parcelas de hoje.`);
    else if (icsd != null && icsd < PREMISSAS.icsdPiso) add("medio", "Capacidade", `ICSD atual de ${icsd.toFixed(2).replace(".", ",")}, abaixo do piso de ${PREMISSAS.icsdPiso.toFixed(2).replace(".", ",")} das operações estruturadas.`);
    if (parcelaMax != null && parcelaMax <= 0) add("alto", "Capacidade", "Sem folga para nova parcela mantendo ICSD de 1,30.");
    const icsdEstresse = estresse[2].icsd;
    if (icsdEstresse != null && icsdEstresse < 1) add("medio", "Estresse", `No cenário combinado (receita −20% e juros +3 p.p.) o ICSD cai para ${icsdEstresse.toFixed(2).replace(".", ",")}.`);
    const conv = div(fluxoExtratos, ebitdaMensal);
    if (conv != null && conv < PREMISSAS.conversaoCaixaMinima) add("medio", "Caixa", `Só ${pct(conv)} do EBITDA aparece como caixa nos extratos: capital de giro consumindo o resultado.`);
  } else {
    const ir = doTipo("imposto_renda", ["ir_pf"]).map((l) => l.dados!).sort((a, b) => (num(b.ano_calendario) ?? 0) - (num(a.ano_calendario) ?? 0))[0] ?? null;
    const rendaIr = ir ? (soma(num(ir.rendimentos_tributaveis), num(ir.rendimentos_isentos)) ?? 0) / 12 : null;
    const rendaDoc = media(doTipo("renda").flatMap((l) => ((l.dados!.meses as Array<{ liquido?: number }>) ?? []).map((m) => num(m.liquido)).filter((x): x is number => x != null)));
    const rendaExtratos = extratos?.entradasMediaMensal ?? null;
    const candidatos = [rendaIr, rendaDoc, rendaExtratos].filter((x): x is number => x != null && x > 0);
    const renda = candidatos.length ? Math.min(...candidatos) : null;
    const comprometimento = div(servicoDivida, renda);
    const parcelaMax = renda != null ? renda * PREMISSAS.comprometimentoPF - (servicoDivida ?? 0) : null;
    const patrimonioLiquido = ir ? soma(num(ir.bens_direitos_total_ano), num(ir.dividas_onus_total_ano) != null ? -num(ir.dividas_onus_total_ano)! : null) : null;
    capacidade = {
      rendaMensal: r2(renda), rendaIrMensal: r2(rendaIr), rendaComprovadaMensal: r2(rendaDoc), entradasExtratosMensal: rendaExtratos,
      servicoDividaMensal: r2(servicoDivida), fonteServico, comprometimentoAtual: r4(comprometimento),
      parcelaMaximaNova: r2(parcelaMax != null ? Math.max(parcelaMax, 0) : null),
      creditoMaximo: tabelaCredito(parcelaMax),
      patrimonioLiquidoDeclarado: r2(patrimonioLiquido),
    };
    if (renda == null) add("alto", "Capacidade", "Não foi possível calcular a renda: faltam IR, comprovantes ou extratos lidos.");
    if (comprometimento != null && comprometimento > PREMISSAS.comprometimentoPF) add("alto", "Capacidade", `Comprometimento atual de ${pct(comprometimento)} da renda, acima do limite de ${pct(PREMISSAS.comprometimentoPF)}.`);
  }

  // ── validação cruzada ──
  const cruzamentos: Array<{ cruzamento: string; resultado: string; ok: boolean | null }> = [];
  if (faturamento && extratos) {
    const cob = div(extratos.entradasMediaMensal, faturamento.mediaMensal);
    cruzamentos.push({ cruzamento: "Faturamento × entradas nos extratos", resultado: `Extratos mostram ${pct(cob)} do faturamento informado`, ok: cob == null ? null : cob >= PREMISSAS.coberturaExtratosMinima });
    if (cob != null && cob < PREMISSAS.coberturaExtratosMinima) add("alto", "Consistência", `Os extratos mostram só ${pct(cob)} do faturamento informado.`);
  }
  const receitaFiscal = num(fiscal?.receita_bruta_declarada);
  const exercicioUltimo = ultimo ? exercicios.find((e) => (e.periodo ?? null) === ultimo.periodo) : undefined;
  const receitaDre = ultimo ? (num(exercicioUltimo?.dre?.receita_bruta) ?? ultimo.receitaLiquida ?? null) : null;
  if (receitaFiscal != null && receitaDre != null) {
    const dif = Math.abs(receitaDre - receitaFiscal) / Math.max(receitaFiscal, 1);
    cruzamentos.push({ cruzamento: "DRE × declaração fiscal", resultado: `Diferença de ${pct(dif)} (DRE ${brl(receitaDre)} × Fisco ${brl(receitaFiscal)})`, ok: dif <= PREMISSAS.divergenciaFiscalMaxima });
    if (dif > PREMISSAS.divergenciaFiscalMaxima) add("alto", "Consistência", `Receita da DRE difere ${pct(dif)} da declarada ao Fisco.`);
  }
  if (faturamento && receitaDre != null) {
    const dif = Math.abs(faturamento.total! - receitaDre) / Math.max(receitaDre, 1);
    cruzamentos.push({ cruzamento: "Faturamento 12 meses × DRE", resultado: `Diferença de ${pct(dif)}`, ok: dif <= 0.15 });
  }
  if (parcelasDeclaradas != null && extratos?.parcelasMediaMensal) {
    const dif = (extratos.parcelasMediaMensal - parcelasDeclaradas) / Math.max(parcelasDeclaradas, 1);
    cruzamentos.push({ cruzamento: "Parcelas nos extratos × relação de endividamento", resultado: `Extratos ${brl(extratos.parcelasMediaMensal)}/mês × relação ${brl(parcelasDeclaradas)}/mês`, ok: dif <= 0.1 });
    if (dif > 0.1) add("medio", "Consistência", "Há parcelas pagas nos extratos que não estão na relação de endividamento.");
  }
  if (extratos?.percentualEntradasRelacionadas != null) {
    const p = extratos.percentualEntradasRelacionadas;
    cruzamentos.push({ cruzamento: "Entradas vindas do próprio grupo ou dos sócios", resultado: `${pct(p)} das entradas`, ok: p <= PREMISSAS.entradasRelacionadasMaxima });
    if (p > PREMISSAS.entradasRelacionadasMaxima) add("alto", "Consistência", `${pct(p)} das entradas vêm de contas do mesmo grupo ou dos sócios (possível faturamento circular).`);
  }
  if (perfil === "PJ" && ultimo?.lucroLiquido != null) {
    const lucros = doTipo("imposto_renda", ["ir_socios"]).reduce((s, l) => s + (num(l.dados!.lucros_dividendos_recebidos) ?? 0), 0);
    if (lucros > 0) {
      cruzamentos.push({ cruzamento: "Lucro da empresa × lucros recebidos pelos sócios", resultado: `Sócios receberam ${brl(lucros)} × lucro líquido ${brl(ultimo.lucroLiquido)}`, ok: lucros <= Math.max(ultimo.lucroLiquido, 0) });
      if (lucros > Math.max(ultimo.lucroLiquido, 0)) add("medio", "Governança", "Os sócios retiraram mais lucro do que a empresa gerou no período.");
    }
  }

  // ── alertas dos indicadores ──
  if (ultimo) {
    if (ultimo.liquidezCorrente != null && ultimo.liquidezCorrente < 1) add("medio", "Liquidez", `Liquidez corrente de ${ultimo.liquidezCorrente.toFixed(2).replace(".", ",")}: o curto prazo não cobre as obrigações de curto prazo.`);
    if (ultimo.dividaLiquidaEbitda != null && ultimo.dividaLiquidaEbitda > 3.44) add("medio", "Endividamento", `Dívida líquida de ${ultimo.dividaLiquidaEbitda.toFixed(2).replace(".", ",")}× o EBITDA, acima da média de covenant de mercado (3,44×).`);
    if (ultimo.saldoTesouraria != null && ultimo.saldoTesouraria < 0) add("medio", "Capital de giro", "Saldo de tesouraria negativo: a operação depende de dívida de curto prazo.");
    if (ultimo.margemEbitda != null && ultimo.margemEbitda < 0) add("alto", "Resultado", "EBITDA negativo no último exercício.");
    if (anterior?.tributosARecolher != null && ultimo.tributosARecolher != null && ultimo.tributosARecolher > anterior.tributosARecolher * 1.3)
      add("medio", "Fiscal", "Tributos a recolher cresceram mais de 30% no ano: possível uso de imposto como financiamento.");
  }
  if (crescimentoReceita != null && crescimentoReceita < -0.1) add("medio", "Receita", `Receita caiu ${pct(-crescimentoReceita)} no último exercício.`);
  if (faturamento && faturamento.maiorSequenciaQuedas >= 3) add("medio", "Receita", `Faturamento caiu ${faturamento.maiorSequenciaQuedas} meses seguidos.`);
  if (perfil === "PJ" && !exercicios.length) add("alto", "Documentos", "Sem balanço/DRE lido: indicadores financeiros não calculados.");
  if (!extratosTitular.length) add("medio", "Documentos", "Sem extrato lido: capacidade calculada só pela contabilidade/IR, sem confirmação no banco.");

  // ── raio-X ──
  const raio = raioX(doTipo("extrato").map((l) => ({ banco: (l.dados!.banco as string | null) ?? null, dados: l.dados! })));
  if (raio && raio.pacoteEmMaisDeUmBanco.length) add("info", "Custos", `Pacote de serviços cobrado em ${raio.pacoteEmMaisDeUmBanco.length} bancos.`);
  if (raio && raio.economiaAnualEstimada > 0) add("info", "Custos", `Economia potencial estimada de ${brl(raio.economiaAnualEstimada)} por ano em tarifas, seguros e juros.`);

  const ordem = { alto: 0, medio: 1, info: 2 } as const;
  return {
    versao: 1 as const,
    perfil,
    calculadoEm: new Date().toISOString(),
    premissas: PREMISSAS,
    documentosUsados: lidas.map((l) => ({ item: l.item, arquivo: l.arquivo })),
    indicadores,
    ultimoExercicio: ultimo?.periodo ?? null,
    crescimentoReceita,
    faturamento,
    extratos,
    capacidade,
    cruzamentos,
    raioX: raio,
    alertas: alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]),
  };
}

export type ResultadoCalculo = ReturnType<typeof calcular>;

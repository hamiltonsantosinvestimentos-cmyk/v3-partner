// Análise Estruturada V3 — o que se extrai de cada documento e as checagens automáticas
// da leitura (MELHORIA DA CONSULTA, Fase 1 / entrega 2). A IA só LÊ: todo número sai
// como o documento mostra, e as contas de conferência abaixo são feitas por fórmula fixa.

export type TipoDado =
  | "demonstrativos" | "faturamento" | "extrato" | "fiscal" | "contrato_social"
  | "imposto_renda" | "renda" | "endividamento" | "generico";

/** Item do checklist → tipo de dado extraído. */
export const TIPO_POR_ITEM: Record<string, TipoDado> = {
  balanco_dre: "demonstrativos",
  faturamento: "faturamento",
  extratos_pj: "extrato",
  extratos_pf: "extrato",
  extratos_socios: "extrato",
  fiscal: "fiscal",
  contrato_social: "contrato_social",
  ir_socios: "imposto_renda",
  ir_pf: "imposto_renda",
  renda: "renda",
  endividamento: "endividamento",
  recebiveis: "generico",
  garantia: "generico",
};

const ESQUEMAS: Record<TipoDado, string> = {
  demonstrativos: `{
  "empresa": string|null, "cnpj": string|null,
  "assinado_contador": boolean|null, "contador_nome": string|null, "contador_crc": string|null,
  "exercicios": [ {
    "periodo": string,            // ex.: "2025" ou "jan-ago/2026" (balancete)
    "data_base": "AAAA-MM-DD"|null,
    "balanco": {
      "caixa_equivalentes": number|null, "contas_receber": number|null, "estoques": number|null,
      "ativo_circulante": number|null, "realizavel_longo_prazo": number|null, "imobilizado": number|null,
      "ativo_nao_circulante": number|null, "ativo_total": number|null,
      "fornecedores": number|null, "emprestimos_cp": number|null, "obrigacoes_fiscais_cp": number|null,
      "obrigacoes_trabalhistas_cp": number|null, "passivo_circulante": number|null,
      "emprestimos_lp": number|null, "parcelamentos_fiscais_lp": number|null, "passivo_nao_circulante": number|null,
      "capital_social": number|null, "patrimonio_liquido": number|null, "passivo_total": number|null
    },
    "dre": {
      "receita_bruta": number|null, "deducoes": number|null, "receita_liquida": number|null,
      "custo_vendas": number|null, "lucro_bruto": number|null, "despesas_operacionais": number|null,
      "depreciacao_amortizacao": number|null, "despesas_financeiras": number|null, "receitas_financeiras": number|null,
      "outras_receitas_despesas": number|null, "lucro_antes_ir": number|null, "ir_csll": number|null, "lucro_liquido": number|null
    }
  } ],
  "observacoes": string|null
}`,
  faturamento: `{
  "empresa": string|null, "cnpj": string|null, "assinado_contador": boolean|null,
  "meses": [ { "mes": "AAAA-MM", "valor": number } ],
  "total_informado": number|null,
  "observacoes": string|null
}`,
  extrato: `{
  "banco": string|null, "agencia": string|null, "conta": string|null, "titular": string|null, "titular_documento": string|null,
  "periodo_inicio": "AAAA-MM-DD"|null, "periodo_fim": "AAAA-MM-DD"|null,
  "saldo_inicial": number|null, "saldo_final": number|null,
  "meses": [ { "mes": "AAAA-MM", "saldo_inicial": number|null, "entradas": number, "saidas": number, "saldo_final": number|null } ],
  "cobrancas": [ { "data": "AAAA-MM-DD", "descricao": string, "valor": number } ],
  "parcelas_dividas": [ { "data": "AAAA-MM-DD", "descricao": string, "valor": number } ],
  "entradas_mesma_titularidade": number|null,
  "observacoes": string|null
}
// "cobrancas": TODO débito de tarifa, pacote/cesta de serviços, seguro, capitalização, consórcio,
//   juros, IOF, multa/encargo, anuidade, aluguel de maquininha, mensalidade ou débito automático de serviço.
// "parcelas_dividas": débitos de empréstimo, financiamento, CDC, consignado ou parcela de cartão.
// "entradas_mesma_titularidade": soma das entradas vindas do próprio titular, dos sócios ou de empresas do mesmo grupo.
// "entradas"/"saidas" de cada mês são valores positivos.`,
  fiscal: `{
  "tipo": "PGDAS-D"|"DEFIS"|"ECF"|"ECD"|"outro", "empresa": string|null, "cnpj": string|null,
  "regime": "Simples Nacional"|"Lucro Presumido"|"Lucro Real"|null,
  "periodo": string|null, "receita_bruta_declarada": number|null,
  "receitas_mensais": [ { "mes": "AAAA-MM", "valor": number } ],
  "observacoes": string|null
}`,
  contrato_social: `{
  "razao_social": string|null, "cnpj": string|null, "data_constituicao": "AAAA-MM-DD"|null, "data_ultima_alteracao": "AAAA-MM-DD"|null,
  "capital_social": number|null,
  "socios": [ { "nome": string, "cpf_cnpj": string|null, "participacao_percentual": number|null, "administrador": boolean|null } ],
  "objeto_social": string|null, "observacoes": string|null
}`,
  imposto_renda: `{
  "nome": string|null, "cpf": string|null, "ano_calendario": number|null, "ano_exercicio": number|null,
  "rendimentos_tributaveis": number|null, "rendimentos_isentos": number|null,
  "lucros_dividendos_recebidos": number|null, "pro_labore": number|null,
  "rendimentos_tributacao_exclusiva": number|null, "imposto_devido": number|null,
  "bens_direitos_total_ano": number|null, "bens_direitos_total_ano_anterior": number|null,
  "dividas_onus_total_ano": number|null,
  "bens": [ { "descricao": string, "valor": number|null } ],
  "participacoes_societarias": [ { "empresa": string, "cnpj": string|null, "valor": number|null } ],
  "recibo_entrega": boolean|null,
  "observacoes": string|null
}`,
  renda: `{
  "nome": string|null, "tipo": "holerite"|"pro_labore"|"decore"|"outro"|null, "empregador_fonte": string|null,
  "meses": [ { "mes": "AAAA-MM", "bruto": number|null, "liquido": number|null } ],
  "observacoes": string|null
}`,
  endividamento: `{
  "dividas": [ { "credor": string, "modalidade": string|null, "saldo_devedor": number|null, "parcela_mensal": number|null,
                 "prazo_restante_meses": number|null, "taxa_mensal_percentual": number|null, "garantia": string|null } ],
  "total_saldo_devedor": number|null, "total_parcelas_mensais": number|null,
  "observacoes": string|null
}`,
  generico: `{
  "tipo_documento": string|null, "resumo": string|null,
  "valores": [ { "descricao": string, "valor": number|null } ],
  "observacoes": string|null
}`,
};

export function promptExtracao(tipo: TipoDado, rotuloItem: string, nomeArquivo: string): string {
  return `Documento enviado pelo cliente no item "${rotuloItem}" (arquivo "${nomeArquivo}").

Extraia os dados e responda APENAS com um JSON neste formato (os comentários explicam os campos; não os repita):
${ESQUEMAS[tipo]}

Regras:
- Valores em reais como número, com ponto decimal e sem separador de milhar (ex.: 1234567.89). Valores negativos com sinal.
- Copie os números exatamente como aparecem no documento. NUNCA estime, calcule por conta própria ou invente: o que não estiver no documento é null.
- Se o documento não for do tipo esperado, preencha "observacoes" dizendo o que ele é.
- Datas em AAAA-MM-DD e meses em AAAA-MM.`;
}

export const SYSTEM_EXTRACAO =
  "Você é um analista contábil e financeiro sênior que extrai dados de documentos brasileiros " +
  "(balanços, DREs, extratos bancários, declarações fiscais e de imposto de renda) para uma análise de crédito. " +
  "Responda somente com JSON válido, sem markdown e sem texto antes ou depois.";

// ── Checagens automáticas da leitura ────────────────────────────────────────

export interface Validacao { regra: string; ok: boolean | null; detalhe: string }

type Num = number | null | undefined;
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function bate(a: Num, b: Num, tolerancia = 0.01): boolean | null {
  if (a == null || b == null) return null;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base <= tolerancia || Math.abs(a - b) <= 1;
}

export function validar(tipo: TipoDado, dados: Record<string, unknown>): Validacao[] {
  const out: Validacao[] = [];
  const add = (regra: string, ok: boolean | null, detalhe: string) => out.push({ regra, ok, detalhe });

  if (tipo === "demonstrativos") {
    const exs = (dados.exercicios as Array<{ periodo?: string; balanco?: Record<string, unknown>; dre?: Record<string, unknown> }>) ?? [];
    if (!exs.length) add("Exercícios encontrados", false, "Nenhum balanço ou DRE identificado no arquivo.");
    for (const ex of exs) {
      const b = ex.balanco ?? {}; const d = ex.dre ?? {};
      const p = ex.periodo ?? "?";
      const at = n(b.ativo_total);
      const pt = n(b.passivo_total) ?? (() => {
        const pc = n(b.passivo_circulante), pnc = n(b.passivo_nao_circulante), pl = n(b.patrimonio_liquido);
        return pc != null && pnc != null && pl != null ? pc + pnc + pl : null;
      })();
      const ok1 = bate(at, pt);
      add(`Balanço fecha (${p})`, ok1, ok1 == null ? "Totais de ativo ou passivo não encontrados." : `Ativo ${brl(at!)} × Passivo + PL ${brl(pt!)}`);
      const ac = n(b.ativo_circulante), anc = n(b.ativo_nao_circulante);
      const ok2 = ac != null && anc != null ? bate(ac + anc, at) : null;
      if (ok2 != null) add(`Ativo soma (${p})`, ok2, `Circulante + não circulante ${brl(ac! + anc!)} × total ${brl(at ?? 0)}`);
      const rl = n(d.receita_liquida), cv = n(d.custo_vendas), lb = n(d.lucro_bruto);
      const ok3 = rl != null && cv != null && lb != null ? bate(rl - Math.abs(cv), lb) : null;
      if (ok3 != null) add(`Lucro bruto confere (${p})`, ok3, `Receita líquida − custo ${brl(rl! - Math.abs(cv!))} × lucro bruto ${brl(lb!)}`);
    }
    if (dados.assinado_contador === false) add("Assinatura do contador", false, "Demonstrativo sem assinatura do contador.");
  }

  if (tipo === "faturamento") {
    const meses = (dados.meses as Array<{ mes?: string; valor?: number }>) ?? [];
    add("12 meses informados", meses.length >= 12, `${meses.length} mês(es) encontrados.`);
    const soma = meses.reduce((s, m) => s + (n(m.valor) ?? 0), 0);
    const tot = n(dados.total_informado);
    if (tot != null) add("Total confere com os meses", bate(soma, tot), `Soma dos meses ${brl(soma)} × total ${brl(tot)}`);
  }

  if (tipo === "extrato") {
    const meses = (dados.meses as Array<{ mes?: string; saldo_inicial?: number; entradas?: number; saidas?: number; saldo_final?: number }>) ?? [];
    if (!meses.length) add("Movimentação mensal", false, "Nenhum mês de movimentação identificado.");
    let quebras = 0, conferidos = 0;
    for (const m of meses) {
      const si = n(m.saldo_inicial), sf = n(m.saldo_final), e = n(m.entradas), s = n(m.saidas);
      if (si == null || sf == null || e == null || s == null) continue;
      conferidos++;
      if (!bate(si + e - Math.abs(s), sf, 0.005)) quebras++;
    }
    if (conferidos) add("Saldos fecham mês a mês", quebras === 0, quebras === 0
      ? `${conferidos} mês(es) conferidos: saldo inicial + entradas − saídas = saldo final.`
      : `${quebras} de ${conferidos} mês(es) não fecham. Pode ser leitura incompleta ou extrato alterado: conferir.`);
    for (let i = 1; i < meses.length; i++) {
      const ant = n(meses[i - 1].saldo_final), atual = n(meses[i].saldo_inicial);
      if (ant != null && atual != null && !bate(ant, atual, 0.005)) {
        add("Continuidade entre meses", false, `Saldo final de ${meses[i - 1].mes} (${brl(ant)}) diferente do inicial de ${meses[i].mes} (${brl(atual)}).`);
        break;
      }
    }
  }

  if (tipo === "imposto_renda") {
    add("Ano-calendário identificado", n(dados.ano_calendario) != null, n(dados.ano_calendario) != null ? String(dados.ano_calendario) : "Não encontrado.");
    if (dados.recibo_entrega === false) add("Recibo de entrega", false, "Recibo de entrega não encontrado no arquivo.");
  }

  if (tipo === "endividamento") {
    const dividas = (dados.dividas as Array<{ parcela_mensal?: number }>) ?? [];
    const soma = dividas.reduce((s, d) => s + (n(d.parcela_mensal) ?? 0), 0);
    const tot = n(dados.total_parcelas_mensais);
    if (tot != null) add("Total de parcelas confere", bate(soma, tot), `Soma ${brl(soma)} × total ${brl(tot)}`);
  }

  return out;
}

// ── Classificação de lançamentos (OFX; base do raio-X de custos da entrega 3) ──

export const PALAVRAS_COBRANCA = [
  "TARIFA", "TAR ", "TAR.", "CESTA", "PACOTE", "MANUT", "SEGURO", "SEG ", "PRESTAMISTA", "CAPITALIZ", "CAP ",
  "CONSORCIO", "JUROS", "IOF", "MULTA", "ENCARGO", "MORA", "ANUIDADE", "ALUGUEL MAQ", "ALUG MAQ", "MENSALIDADE",
  "ASSINATURA", "DEB AUT", "DEBITO AUTOMATICO", "TAXA",
];
export const PALAVRAS_PARCELA = ["EMPREST", "EMPRÉST", "FINANC", "PARC ", "PARCELA", "CDC", "CONSIGN", "AMORTIZ", "PRESTACAO", "PRESTAÇÃO"];

export function ehCobranca(descricao: string): boolean {
  const d = ` ${descricao.toUpperCase()} `;
  return PALAVRAS_COBRANCA.some((p) => d.includes(p));
}
export function ehParcela(descricao: string): boolean {
  const d = descricao.toUpperCase();
  return PALAVRAS_PARCELA.some((p) => d.includes(p));
}

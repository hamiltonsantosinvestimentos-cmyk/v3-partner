import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface CreditReportSource {
  key: string;
  label: string;
  scope: string;
  consulted: boolean;
}

export interface CreditReportSocio {
  nome: string;
  qualificacao: string | null;
  cpfMascarado: string | null;
  entrada: string | null;
  faixaEtaria: string | null;
}

export interface CreditReportProcesso {
  numeroCnj: string;
  tribunal: string | null;
  classe: string | null;
  assunto: string | null;
  area: string | null;
  polo: string | null;
  poloAtivo: string | null;
  poloPassivo: string | null;
  valorCausa: string | null;
  valorCausaNum: number | null;
  dataDistribuicao: string | null;
  orgaoJulgador: string | null;
  estado: string | null;
  movimentacoes: number | null;
  ultimaMovimentacao: string | null;
  arquivado: boolean;
  severity: string | null;
  url: string | null;
}

export interface CreditReportData {
  code: string;
  subjectName: string;
  subjectCpfCnpj: string;
  subjectType: "PF" | "PJ";
  emittedAt: string;
  validUntil: string;
  validUntilISO: string;
  sources: CreditReportSource[];

  scores: {
    identidade: number | null;
    credito: number | null;
    judicial: number | null;
    patrimonial: number | null;
    comportamental: number | null;
    setorial: number | null;
    total: number | null;
    tier: string | null;
    tierLabel: string;
    spreadMin: number | null;
    spreadMax: number | null;
  };

  cadastro: {
    hasData: boolean;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    situacao: string | null;
    dataAbertura: string | null;
    capitalSocial: string | null;
    porte: string | null;
    naturezaJuridica: string | null;
    cnaePrincipal: string | null;
    endereco: string | null;
    regimeTributario: string | null;
    socios: CreditReportSocio[];
  };

  serasa: {
    consultado: boolean;
    ambiente: string | null;
    reportUsed: string | null;
    score: number | null;
    scoreMensagem: string | null;
    protestoCount: number;
    protestoValor: string | null;
    pefinCount: number;
    pefinValor: string | null;
    refinCount: number;
    refinValor: string | null;
    dividaVencidaCount: number;
    dividaVencidaValor: string | null;
    chequeSemFundoCount: number;
    acaoJudicialCount: number;
    falenciaCount: number;
    situacaoCadastral: string | null;
    temRestricao: boolean;
  };

  restricoes: Array<{ tipo: string; descricao: string | null; fonte: string | null; impacto: number | null }>;

  /** Bloco legado mantido por compatibilidade com o layout externo anterior. */
  judicial: {
    hasDetailedData: boolean;
    totalCount: number | null;
    items: Array<{ numero: string; classe: string; tribunal: string; polo: string; valorCausa: string }>;
  };

  processos: {
    hasData: boolean;
    total: number;
    totalPassivo: number;
    valorTotalPassivo: string | null;
    items: CreditReportProcesso[];
  };

  bacen: {
    hasData: boolean;
    /** Estrutura do SCR (Registrato BACEN), que é como o dado realmente chega. */
    periodo: string | null;
    emitidoEm: string | null;
    codigoAutenticidade: string | null;
    totalEmDia: string | null;
    totalVencido: string | null;
    temVencido: boolean;
    creditoALiberar: string | null;
    coobrigacoes: string | null;
    limitesCredito: string | null;
    instituicoesAtivas: number | null;
    operacoesAbertas: number | null;
    detalhamentoConfiavel: boolean;
    notaDetalhamento: string | null;
    instituicoes: Array<{
      nome: string;
      emDia: string | null;
      vencida: string | null;
      limites: string | null;
      modalidades: Array<{ grupo: string | null; tipo: string; valor: string | null }>;
    }>;
    /** Campos do formato antigo, mantidos para não quebrar consumidor existente. */
    atraso30: number | null;
    atraso60: number | null;
    atraso90: number | null;
    valorTotalAtraso: string | null;
    concentracaoBancaria: string | null;
  };

  /**
   * SCR do Banco Central via CheckTudo (querycode 3090), consulta automática
   * plugada em 01/09/2026 — canal novo, distinto do Registrato manual em
   * `bacen` acima (upload de PDF pelo titular). Achado 02/09/2026: o motor
   * n8n nunca soube dessa consulta (roda fora do n8n, direto no portal), então
   * `sources_free`/`sources_paid` nunca incluíam "registrato_bacen" mesmo
   * quando a consulta rodou de verdade — o dossiê dizia "não disponível" com
   * dado real disponível ao lado. Corrigido junto com este bloco.
   */
  bacenScr: {
    consultado: boolean;
    scorePontuacao: string | null;
    scoreFaixa: string | null;
    creditoVencidoValor: string | null;
    creditoVencidoOperacoes: Array<{ descricao: string | null; valor: string | null; qtdMeses: string | null }>;
    prejuizoValor: string | null;
    prejuizoOperacoes: Array<{ descricao: string | null; valor: string | null; qtdMeses: string | null }>;
    consultadoEm: string | null;
  };

  ceis: {
    hasMatch: boolean;
    consultado: boolean;
  };

  escavador: {
    hasData: boolean;
    totalProcessos: number | null;
    processos: Array<{ numeroCnj: string; poloAtivo: string | null; poloPassivo: string | null; tribunal: string | null; status: string | null }>;
  };

  diagnostico: {
    fontesConsultadas: number;
    fontesTotais: number;
    cobertura: number;
    alertas: string[];
  };
}

const SOURCE_CATALOG: Array<{ key: string; label: string; scope: string }> = [
  { key: "receita_federal", label: "Receita Federal", scope: "Situação cadastral, CNAE, capital social, quadro societário" },
  { key: "cnj_datajud", label: "CNJ DataJud", scope: "Processos judiciais (TJSP, TRF1 e STJ)" },
  { key: "ceis", label: "CEIS (Portal da Transparência)", scope: "Sanções administrativas e impedimentos de contratar" },
  { key: "registrato_bacen", label: "Registrato BACEN", scope: "Relacionamento bancário e operações de crédito" },
  { key: "serasa", label: "Serasa Experian", scope: "Score, protestos, pefin, refin e pendências financeiras" },
  { key: "escavador", label: "Escavador", scope: "Histórico judicial nacional (justiça estadual, federal e do trabalho)" },
];

/**
 * Validade do dossiê, em dias. Definida com João em 03/08/2026 como 7 dias.
 * Razão: não há como controlar quando uma nova anotação será registrada, porque
 * cada empresa informa os bureaus na sua própria data de corte. O SCR do Banco
 * Central, por sua vez, é renovado sempre no dia 28 de cada mês.
 * Vale também para a expiração do link público e da URL assinada do PDF.
 */
export const REPORT_VALIDITY_DAYS = 7;

const TIER_LABEL: Record<string, string> = {
  A: "A · Excelente",
  B: "B · Bom",
  C: "C · Regular",
  D: "D · Alto Risco",
  E: "E · Recusar",
};

function fmtDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function fmtDateOnly(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v.length <= 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function fmtBRL(v: unknown): string | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDoc(doc: string): string {
  const d = String(doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

/**
 * A Serasa devolve, em alguns relatórios, um literal de campo reservado em vez de
 * mensagem real. Isso não é informação e não pode ser impresso num documento
 * institucional como se fosse leitura do bureau.
 */
function limpaMensagemBureau(msg: unknown): string | null {
  if (typeof msg !== "string") return null;
  const t = msg.trim();
  if (!t) return null;
  if (/ESPACO\s+RESERVADO|ESPAÇO\s+RESERVADO|RESERVADO\s+PARA\s+MENSAGEM/i.test(t)) return null;
  return t;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Monta o dossiê completo a partir de um credit_profiles real.
 *
 * Reescrito em 03/08/2026. A versão anterior assumia que o motor só devolvia
 * contagem de processos ("não existe lista por processo ainda") e lia
 * escavador_data de uma coluna que o motor nunca preenchia, então o relatório
 * saía dizendo "nenhum processo localizado" para sujeitos que tinham vários.
 * Agora lê as tabelas que o motor de fato popula (judicial_records e
 * asset_restrictions) mais os blocos brutos persistidos no próprio perfil.
 *
 * Regra mantida: nunca inventar estrutura. Quando a fonte não trouxe dado,
 * marca hasData como false para o template dizer "não consultado" ou
 * "nada localizado", em vez de exibir tabela vazia como se fosse resultado.
 */
export async function buildCreditReportData(creditProfileId: string): Promise<CreditReportData | null> {
  const svc = serviceClient();

  const { data: profile } = await svc
    .from("credit_profiles")
    .select(
      "id, subject_name, subject_cpf_cnpj, subject_type, created_at, sources_free, sources_paid, flags, raw_result, registrato_data, escavador_data, serasa_data, receita_data, bacen_scr_data, score_identidade, score_credito, score_judicial, score_patrimonial, score_comportamental, score_setorial, score_total, tier, spread_min, spread_max"
    )
    .eq("id", creditProfileId)
    .single();

  if (!profile) return null;

  const [{ data: judicialRows }, { data: restricaoRows }] = await Promise.all([
    svc
      .from("judicial_records")
      .select("numero_processo, tribunal, classe_processual, polo, valor_causa, data_distribuicao, fonte, severity, raw_data")
      .eq("credit_profile_id", creditProfileId)
      .order("data_distribuicao", { ascending: false }),
    svc
      .from("asset_restrictions")
      .select("restriction_type, descricao, fonte, score_impact")
      .eq("credit_profile_id", creditProfileId),
  ]);

  const sourcesFree = (profile.sources_free ?? []) as string[];
  const sourcesPaid = (profile.sources_paid ?? []) as string[];
  const consultedKeys = new Set([...sourcesFree, ...sourcesPaid]);

  const sources: CreditReportSource[] = SOURCE_CATALOG.map((s) => ({
    ...s,
    // registrato_bacen roda fora do n8n desde 01/09/2026 (CheckTudo, direto no
    // portal), nunca aparece em sources_free/sources_paid (só o motor escreve
    // lá). Conta como consultada também quando bacen_scr_data foi de fato
    // preenchido, senão o dossiê acusava "não consultada" com dado real ao lado.
    consulted: s.key === "registrato_bacen" ? (consultedKeys.has(s.key) || bacenScrConsultado) : consultedKeys.has(s.key),
  }));

  const rawResult = (profile.raw_result ?? {}) as Record<string, unknown>;
  const registratoData = (profile.registrato_data ?? {}) as Record<string, unknown>;
  const registratoHasData = Object.keys(registratoData).length > 0;
  const flags = (profile.flags ?? {}) as Record<string, unknown>;
  const ceisMatch = flags.ceis_match === true;

  const rf = (profile.receita_data ?? null) as Record<string, any> | null;
  const ser = (profile.serasa_data ?? null) as Record<string, any> | null;
  const esc = (profile.escavador_data ?? null) as Record<string, any> | null;
  const bacenScr = (profile.bacen_scr_data ?? null) as Record<string, any> | null;
  const bacenScrConsultado = bacenScr !== null;

  const docDigits = String(profile.subject_cpf_cnpj ?? "").replace(/\D/g, "");
  const subjectType: "PF" | "PJ" =
    (profile.subject_type as "PF" | "PJ") ?? (docDigits.length === 14 ? "PJ" : "PF");

  // ---------- Cadastro (Receita Federal) ----------
  const socios: CreditReportSocio[] = Array.isArray(rf?.qsa)
    ? rf!.qsa.map((s: Record<string, any>) => ({
        nome: String(s.nome_socio ?? "").trim(),
        qualificacao: s.qualificacao_socio ?? null,
        cpfMascarado: s.cnpj_cpf_do_socio ?? null,
        entrada: fmtDateOnly(s.data_entrada_sociedade),
        faixaEtaria: s.faixa_etaria ?? null,
      }))
    : [];

  const enderecoParts = rf
    ? [
        [rf.descricao_tipo_de_logradouro, rf.logradouro].filter(Boolean).join(" "),
        rf.numero,
        rf.complemento,
        rf.bairro,
        [rf.municipio, rf.uf].filter(Boolean).join(" / "),
      ].filter((p) => p && String(p).trim())
    : [];

  const regimes: string[] = Array.isArray(rf?.regime_tributario)
    ? Array.from(
        new Set(
          rf!.regime_tributario
            .map((r: Record<string, any>) => r?.forma_de_tributacao)
            .filter(Boolean) as string[]
        )
      )
    : [];

  // ---------- Processos (Escavador e demais fontes persistidas) ----------
  const items: CreditReportProcesso[] = (judicialRows ?? []).map((r: Record<string, any>) => {
    const raw = (r.raw_data ?? {}) as Record<string, any>;
    const valorNum = typeof r.valor_causa === "number" ? r.valor_causa : parseFloat(r.valor_causa ?? "");
    return {
      numeroCnj: r.numero_processo,
      tribunal: r.tribunal ?? null,
      classe: r.classe_processual ?? null,
      assunto: raw.assunto ?? null,
      area: raw.area ?? null,
      polo: r.polo ?? null,
      poloAtivo: raw.polo_ativo ?? null,
      poloPassivo: raw.polo_passivo ?? null,
      valorCausa: fmtBRL(r.valor_causa),
      valorCausaNum: Number.isFinite(valorNum) ? valorNum : null,
      dataDistribuicao: fmtDateOnly(r.data_distribuicao),
      orgaoJulgador: raw.orgao_julgador ?? null,
      estado: raw.estado ?? null,
      movimentacoes: raw.quantidade_movimentacoes ?? null,
      ultimaMovimentacao: fmtDateOnly(raw.data_ultima_movimentacao),
      arquivado: raw.arquivado === true,
      severity: r.severity ?? null,
      url: raw.url ?? null,
    };
  });

  const passivos = items.filter((p) => p.polo === "passivo");
  const valorTotalPassivo = passivos.reduce((acc, p) => acc + (p.valorCausaNum ?? 0), 0);

  // ---------- Restrições ----------
  const restricoes = (restricaoRows ?? []).map((r: Record<string, any>) => ({
    tipo: r.restriction_type,
    descricao: r.descricao ?? null,
    fonte: r.fonte ?? null,
    impacto: typeof r.score_impact === "number" ? r.score_impact : null,
  }));

  // ---------- Diagnóstico de cobertura ----------
  const alertas: string[] = [];
  if (!consultedKeys.has("serasa")) {
    alertas.push("Serasa não consultada nesta análise. Score de crédito e restrições financeiras usaram valor neutro.");
  }
  if (!consultedKeys.has("escavador")) {
    alertas.push("Escavador não consultado. A cobertura judicial fica limitada aos tribunais do CNJ DataJud.");
  }
  if (!registratoHasData && !bacenScrConsultado) {
    alertas.push("Registrato BACEN não disponível. Endividamento bancário e concentração não puderam ser avaliados.");
  }
  if (typeof rawResult.ceis_error === "string" && rawResult.ceis_error) {
    alertas.push(`Consulta de sanções CEIS falhou: ${rawResult.ceis_error}.`);
  }
  if (typeof rawResult.escavador_error === "string" && rawResult.escavador_error) {
    alertas.push(`Consulta Escavador falhou: ${rawResult.escavador_error}.`);
  }
  const datajudErrors = Array.isArray(rawResult.datajud_errors) ? (rawResult.datajud_errors as string[]) : [];
  if (datajudErrors.length > 0) {
    alertas.push(`CNJ DataJud com falha parcial: ${datajudErrors.join("; ")}.`);
  }

  const fontesConsultadas = sources.filter((s) => s.consulted).length;

  return {
    code: profile.id.slice(0, 8).toUpperCase(),
    subjectName: profile.subject_name,
    subjectCpfCnpj: fmtDoc(profile.subject_cpf_cnpj),
    subjectType,
    emittedAt: fmtDateBR(profile.created_at),
    validUntil: addDays(profile.created_at, REPORT_VALIDITY_DAYS),
    validUntilISO: addDaysISO(profile.created_at, REPORT_VALIDITY_DAYS),
    sources,

    scores: {
      identidade: profile.score_identidade ?? null,
      credito: profile.score_credito ?? null,
      judicial: profile.score_judicial ?? null,
      patrimonial: profile.score_patrimonial ?? null,
      comportamental: profile.score_comportamental ?? null,
      setorial: profile.score_setorial ?? null,
      total: profile.score_total ?? null,
      tier: profile.tier ?? null,
      tierLabel: TIER_LABEL[profile.tier as string] ?? (profile.tier ?? "Não classificado"),
      spreadMin: profile.spread_min ?? null,
      spreadMax: profile.spread_max ?? null,
    },

    cadastro: {
      hasData: rf !== null,
      razaoSocial: rf?.razao_social ?? null,
      nomeFantasia: rf?.nome_fantasia || null,
      situacao: rf?.descricao_situacao_cadastral ?? null,
      dataAbertura: fmtDateOnly(rf?.data_inicio_atividade),
      capitalSocial: fmtBRL(rf?.capital_social),
      porte: rf?.porte ?? null,
      naturezaJuridica: rf?.natureza_juridica ?? null,
      cnaePrincipal: rf?.cnae_fiscal_descricao
        ? `${rf.cnae_fiscal} · ${rf.cnae_fiscal_descricao}`
        : null,
      endereco: enderecoParts.length ? enderecoParts.join(", ") : null,
      regimeTributario: regimes.length ? regimes.join(", ") : null,
      socios,
    },

    serasa: {
      consultado: ser !== null,
      ambiente: ser?.ambiente ?? null,
      reportUsed: ser?.report_used ?? null,
      score: typeof ser?.score_positivo === "number" ? ser.score_positivo : null,
      scoreMensagem: limpaMensagemBureau(ser?.score_message),
      protestoCount: ser?.protesto_count ?? 0,
      protestoValor: fmtBRL(ser?.protesto_valor),
      pefinCount: ser?.pefin_count ?? 0,
      pefinValor: fmtBRL(ser?.pefin_valor),
      refinCount: ser?.refin_count ?? 0,
      refinValor: fmtBRL(ser?.refin_valor),
      dividaVencidaCount: ser?.divida_vencida_count ?? 0,
      dividaVencidaValor: fmtBRL(ser?.divida_vencida_valor),
      chequeSemFundoCount: ser?.cheque_sem_fundo_count ?? 0,
      acaoJudicialCount: ser?.acao_judicial_count ?? 0,
      falenciaCount: ser?.falencia_count ?? 0,
      situacaoCadastral: ser?.situacao_cadastral ?? null,
      temRestricao:
        (ser?.protesto_count ?? 0) > 0 ||
        (ser?.pefin_count ?? 0) > 0 ||
        (ser?.refin_count ?? 0) > 0 ||
        (ser?.divida_vencida_count ?? 0) > 0 ||
        (ser?.cheque_sem_fundo_count ?? 0) > 0 ||
        (ser?.falencia_count ?? 0) > 0,
    },

    restricoes,

    judicial: {
      hasDetailedData: items.length > 0,
      totalCount: items.length > 0 ? items.length : (typeof rawResult.datajud_total === "number" ? rawResult.datajud_total : null),
      items: items.map((p) => ({
        numero: p.numeroCnj,
        classe: p.classe ?? "Não informada",
        tribunal: p.tribunal ?? "Não informado",
        polo: p.polo ?? "Não informado",
        valorCausa: p.valorCausa ?? "Não informado",
      })),
    },

    processos: {
      hasData: items.length > 0,
      total: items.length,
      totalPassivo: passivos.length,
      valorTotalPassivo: passivos.length ? fmtBRL(valorTotalPassivo) : null,
      items,
    },

    bacen: {
      hasData: registratoHasData,
      periodo: (registratoData.periodo as string) ?? null,
      emitidoEm: registratoData.emitido_em
        ? new Date(registratoData.emitido_em as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : null,
      codigoAutenticidade: (registratoData.codigo_autenticidade as string) ?? null,
      totalEmDia: fmtBRL(registratoData.total_em_dia),
      totalVencido: fmtBRL(registratoData.total_vencido),
      temVencido: Number(registratoData.total_vencido ?? 0) > 0,
      creditoALiberar: fmtBRL(registratoData.credito_a_liberar),
      coobrigacoes: fmtBRL(registratoData.coobrigacoes),
      limitesCredito: fmtBRL(registratoData.limites_credito),
      instituicoesAtivas: (registratoData.instituicoes_ativas as number) ?? null,
      operacoesAbertas: (registratoData.operacoes_abertas as number) ?? null,
      detalhamentoConfiavel: registratoData.detalhamento_confiavel !== false,
      notaDetalhamento: (registratoData.nota_detalhamento as string) ?? null,
      instituicoes: Array.isArray(registratoData.instituicoes)
        ? (registratoData.instituicoes as Array<Record<string, any>>).map((i) => ({
            nome: String(i.nome ?? ""),
            emDia: fmtBRL(i.em_dia),
            vencida: fmtBRL(i.vencida),
            limites: fmtBRL(i.limites_credito),
            modalidades: Array.isArray(i.modalidades)
              ? i.modalidades.map((m: Record<string, any>) => ({
                  grupo: m.grupo ?? null,
                  tipo: String(m.tipo ?? ""),
                  valor: fmtBRL(m.valor),
                }))
              : [],
          }))
        : [],
      atraso30: (registratoData.atraso_30 as number) ?? null,
      atraso60: (registratoData.atraso_60 as number) ?? null,
      atraso90: (registratoData.atraso_90 as number) ?? null,
      valorTotalAtraso: (registratoData.valor_total_atraso as string) ?? null,
      concentracaoBancaria: (registratoData.concentracao_bancaria as string) ?? null,
    },

    bacenScr: {
      consultado: bacenScrConsultado,
      scorePontuacao: (bacenScr?.score_pontuacao as string) ?? null,
      scoreFaixa: (bacenScr?.score_faixa as string) ?? null,
      creditoVencidoValor: (bacenScr?.credito_vencido_valor as string) ?? null,
      creditoVencidoOperacoes: Array.isArray(bacenScr?.credito_vencido_operacoes)
        ? (bacenScr!.credito_vencido_operacoes as Array<Record<string, any>>).map((o) => ({
            descricao: o.descricao ?? null,
            valor: o.valor ?? null,
            qtdMeses: o.qtd_meses ?? null,
          }))
        : [],
      prejuizoValor: (bacenScr?.prejuizo_valor as string) ?? null,
      prejuizoOperacoes: Array.isArray(bacenScr?.prejuizo_operacoes)
        ? (bacenScr!.prejuizo_operacoes as Array<Record<string, any>>).map((o) => ({
            descricao: o.descricao ?? null,
            valor: o.valor ?? null,
            qtdMeses: o.qtd_meses ?? null,
          }))
        : [],
      consultadoEm: bacenScr?.consultado_em
        ? new Date(bacenScr.consultado_em as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : null,
    },

    // consultado precisa ser explícito: sem isso o dossiê afirmava "nenhuma sanção
    // localizada" para sujeito cuja consulta ao CEIS nunca aconteceu (PF é pulada).
    ceis: { hasMatch: ceisMatch, consultado: consultedKeys.has("ceis") },

    escavador: {
      hasData: esc !== null && !esc.disabled,
      totalProcessos: typeof esc?.total === "number" ? esc.total : (typeof esc?.total_processos === "number" ? esc.total_processos : null),
      processos: items.slice(0, 10).map((p) => ({
        numeroCnj: p.numeroCnj,
        poloAtivo: p.poloAtivo,
        poloPassivo: p.poloPassivo,
        tribunal: p.tribunal,
        status: p.arquivado ? "Arquivado" : "Em andamento",
      })),
    },

    diagnostico: {
      fontesConsultadas,
      fontesTotais: SOURCE_CATALOG.length,
      cobertura: Math.round((fontesConsultadas / SOURCE_CATALOG.length) * 100),
      alertas,
    },
  };
}

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

export interface CreditReportData {
  code: string;
  subjectName: string;
  subjectCpfCnpj: string;
  emittedAt: string;
  validUntil: string;
  validUntilISO: string;
  sources: CreditReportSource[];
  judicial: {
    hasDetailedData: boolean;
    totalCount: number | null;
    items: Array<{ numero: string; classe: string; tribunal: string; polo: string; valorCausa: string }>;
  };
  bacen: {
    hasData: boolean;
    instituicoesAtivas: number | null;
    operacoesAbertas: number | null;
    atraso30: number | null;
    atraso60: number | null;
    atraso90: number | null;
    valorTotalAtraso: string | null;
    concentracaoBancaria: string | null;
  };
  ceis: {
    hasMatch: boolean;
  };
}

const SOURCE_CATALOG: Array<{ key: string; label: string; scope: string }> = [
  { key: "receita_federal", label: "Receita Federal", scope: "Situação cadastral, CNAE, capital social, quadro societário" },
  { key: "cnj_datajud", label: "CNJ DataJud", scope: "Processos judiciais (esfera cível, fiscal e trabalhista)" },
  { key: "ceis", label: "CEIS (Portal da Transparência)", scope: "Sanções administrativas e impedimentos de contratar" },
  { key: "registrato_bacen", label: "Registrato BACEN", scope: "Relacionamento bancário e operações de crédito" },
  { key: "serasa", label: "Serasa", scope: "Score e pendências financeiras" },
  { key: "spc", label: "SPC", scope: "Negativações" },
  { key: "escavador", label: "Escavador", scope: "Histórico judicial ampliado e patrimonial" },
];

function fmtDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
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
 * Monta os dados factuais (Layout Externo) a partir de um credit_profiles real.
 * Nunca inventa estrutura: quando a fonte não retorna dado detalhado hoje
 * (ex.: raw_result só tem contagem, registrato_data vazio), marca hasDetailedData/hasData
 * como false para o template mostrar "não localizado" em vez de uma tabela fictícia.
 */
export async function buildCreditReportData(creditProfileId: string): Promise<CreditReportData | null> {
  const svc = serviceClient();

  const { data: profile } = await svc
    .from("credit_profiles")
    .select("id, subject_name, subject_cpf_cnpj, created_at, sources_free, sources_paid, flags, raw_result, registrato_data")
    .eq("id", creditProfileId)
    .single();

  if (!profile) return null;

  const sourcesFree = (profile.sources_free ?? []) as string[];
  const sourcesPaid = (profile.sources_paid ?? []) as string[];
  const consultedKeys = new Set([...sourcesFree, ...sourcesPaid]);

  const sources: CreditReportSource[] = SOURCE_CATALOG.map((s) => ({
    ...s,
    consulted: consultedKeys.has(s.key),
  }));

  const rawResult = (profile.raw_result ?? {}) as Record<string, unknown>;
  const datajudTotal = typeof rawResult.datajud_total === "number" ? rawResult.datajud_total : null;
  // O motor hoje só conta ocorrências (datajud_total); não existe lista por processo ainda.
  const judicialItems: CreditReportData["judicial"]["items"] = [];

  const registratoData = (profile.registrato_data ?? {}) as Record<string, unknown>;
  const registratoHasData = Object.keys(registratoData).length > 0;

  const flags = (profile.flags ?? {}) as Record<string, unknown>;
  const ceisMatch = flags.ceis_match === true;

  return {
    code: profile.id.slice(0, 8).toUpperCase(),
    subjectName: profile.subject_name,
    subjectCpfCnpj: profile.subject_cpf_cnpj,
    emittedAt: fmtDateBR(profile.created_at),
    validUntil: addDays(profile.created_at, 30),
    validUntilISO: addDaysISO(profile.created_at, 30),
    sources,
    judicial: {
      hasDetailedData: judicialItems.length > 0,
      totalCount: datajudTotal,
      items: judicialItems,
    },
    bacen: {
      hasData: registratoHasData,
      instituicoesAtivas: (registratoData.instituicoes_ativas as number) ?? null,
      operacoesAbertas: (registratoData.operacoes_abertas as number) ?? null,
      atraso30: (registratoData.atraso_30 as number) ?? null,
      atraso60: (registratoData.atraso_60 as number) ?? null,
      atraso90: (registratoData.atraso_90 as number) ?? null,
      valorTotalAtraso: (registratoData.valor_total_atraso as string) ?? null,
      concentracaoBancaria: (registratoData.concentracao_bancaria as string) ?? null,
    },
    ceis: {
      hasMatch: ceisMatch,
    },
  };
}

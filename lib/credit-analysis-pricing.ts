// Preço modular da Análise de Crédito D2C (/analise-v2).
// Substitui os 2 pacotes fixos (R$497 / R$997) criados em 23/07/2026.
// Compartilhado entre client (total ao vivo no configurador) e server
// (cálculo autoritativo antes de gerar a cobrança na Cora) — nunca duplicar
// a fórmula em outro lugar.

export const UNIT_PRICE_CENTS = 19700; // R$ 197,00 por CNPJ ou CPF analisado
// Fallback legado (sem perfil definido): usado por legacyPlanoToSelection
// (/analise Variante A, congelada) e por qualquer clampSelection() chamado
// sem mínimos explícitos. Nunca usado no fluxo novo de /analise-v2.
export const MIN_CNPJ_COUNT = 1;
export const MIN_CPF_COUNT = 0;

export interface ModularSelection {
  cnpjCount: number;
  cpfCount: number;
  hasConsultancy: boolean;
}

export interface MinCounts {
  minCnpj: number;
  minCpf: number;
}

// Qualificação de perfil, adicionada em 26/08/2026 para blindar 2 problemas
// reais: empresário comprando só CNPJ (diagnóstico incompleto sem o sócio/
// garantidor, que é quem qualquer fundo/securitizadora também analisa) e
// pessoa física sem empresa travada comprando 1 CNPJ que não precisa (o
// antigo MIN_CNPJ_COUNT=1 era aplicado incondicionalmente).
export type ProfileType = "PF" | "PJ";
export type CompanyStructure = "UNIPESSOAL" | "MULTIPLOS_SOCIOS";

// Mínimos de negócio por perfil. `profileType`/`companyStructure` nulos
// (perfil ainda não escolhido no fluxo guiado, ou chamada fora desse fluxo)
// caem no fallback legado MIN_CNPJ_COUNT/MIN_CPF_COUNT.
export function getMinCounts(profileType: ProfileType | null, companyStructure: CompanyStructure | null): MinCounts {
  if (profileType === "PF") return { minCnpj: 0, minCpf: 1 };
  if (profileType === "PJ") {
    if (companyStructure === "MULTIPLOS_SOCIOS") return { minCnpj: 1, minCpf: 2 };
    return { minCnpj: 1, minCpf: 1 }; // UNIPESSOAL, ou estrutura ainda não escolhida
  }
  return { minCnpj: MIN_CNPJ_COUNT, minCpf: MIN_CPF_COUNT };
}

export function clampSelection(sel: Partial<ModularSelection>, min?: Partial<MinCounts>): ModularSelection {
  const minCnpj = min?.minCnpj ?? MIN_CNPJ_COUNT;
  const minCpf = min?.minCpf ?? MIN_CPF_COUNT;
  const cnpjCount = Math.max(minCnpj, Math.floor(sel.cnpjCount ?? minCnpj));
  const cpfCount = Math.max(minCpf, Math.floor(sel.cpfCount ?? minCpf));
  return { cnpjCount, cpfCount, hasConsultancy: Boolean(sel.hasConsultancy) };
}

export function calcTotalCents(sel: ModularSelection): number {
  const totalAnalyses = sel.cnpjCount + sel.cpfCount;
  return totalAnalyses * UNIT_PRICE_CENTS + (sel.hasConsultancy ? UNIT_PRICE_CENTS : 0);
}

export function fmtBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// Título usado no invoice da Cora, no email de confirmação e na listagem
// da Mesa (Credit Engine). Ex.: "Análise de Crédito Empresarial (2 CNPJ +
// 1 CPF) + Consultoria Estratégica V3".
export function buildModularTitle(sel: ModularSelection): string {
  const parts: string[] = [];
  if (sel.cnpjCount > 0) parts.push(`${sel.cnpjCount} CNPJ`);
  if (sel.cpfCount > 0) parts.push(`${sel.cpfCount} CPF`);
  const base = `Análise de Crédito Empresarial (${parts.join(" + ")})`;
  return sel.hasConsultancy ? `${base} + Consultoria Estratégica V3` : base;
}

// Fallback para pedidos criados antes desta migration (cnpj_count NULL no
// banco) — mesmo dicionário que já existia em app/api/cora/webhook e
// app/api/credit-engine/orders antes desta mudança. Nunca aplicar a pedido
// novo (sempre tem cnpj_count preenchido).
export const LEGACY_DIRECT_TITLES: Record<string, string> = {
  credit_analysis: "Análise de Crédito Empresarial",
  credit_analysis_consultoria: "Análise de Crédito Empresarial + Consultoria Estratégica V3",
};

// Mapeia o parâmetro legado ?plano= (usado por /analise, Variante A, que não
// foi tocada nesta mudança) para uma seleção modular equivalente, para o
// checkout compartilhado continuar funcionando sem alterar a Variante A.
export function legacyPlanoToSelection(plano: string | null): ModularSelection {
  return clampSelection({
    cnpjCount: MIN_CNPJ_COUNT,
    cpfCount: MIN_CPF_COUNT,
    hasConsultancy: plano === "credit_analysis_consultoria",
  });
}

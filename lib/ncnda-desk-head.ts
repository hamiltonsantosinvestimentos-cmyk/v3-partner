// Instrumento NCNDA Mestre (14/08/2026): o signatário "Head" da mesa que
// envia para assinatura varia por origem, regra dada por João em texto,
// não inventada. Cada entrada precisa dos dados reais de qualificação
// jurídica da pessoa (nunca fabricados) — CPF pendente é sinalizado
// explicitamente em vez de inventado, e bloqueia o generate() se usado.
export type DeskOrigin = "MESA_MA" | "BOLSA_ATIVOS" | "CREDITO_ESTRUTURADO" | "CONSORCIO" | "CREDITO_INTERNACIONAL" | "TRADE_FINANCE";

export interface DeskHead {
  roleLabel: string;
  fullName: string;
  qualificacao: string; // nacionalidade, estado civil, profissão — mesmo formato do texto original
  cpf: string | null; // null = pendente, generate() bloqueia até ser informado
  email: string;
}

export const DESK_HEADS: Record<DeskOrigin, DeskHead> = {
  MESA_MA: {
    roleLabel: "SÓCIO ADMINISTRADOR / V3 PARTNERS",
    fullName: "João Lemos Netto",
    qualificacao: "brasileiro, empresário",
    cpf: "078.678.257-97",
    email: "joao.lemos@v3partners.com.br",
  },
  BOLSA_ATIVOS: {
    roleLabel: "DIREÇÃO DE COMPLIANCE / V3 PARTNERS",
    fullName: "Luís Humberto Ferreira de Athaydes",
    qualificacao: "brasileiro, advogado",
    cpf: "783.851.726-53",
    email: "luis.athaydes@v3partners.com.br",
  },
  CREDITO_ESTRUTURADO: {
    roleLabel: "SÓCIO RESPONSÁVEL, MESA DE CRÉDITO / V3 PARTNERS",
    fullName: "Hamilton Santos",
    qualificacao: "brasileiro, empresário",
    // Achado 14/08/2026: CPF real não localizado em nenhuma fonte segura do
    // repositório (migrations, wiki, .docx societário ilegível como binário).
    // Nunca fabricado. generate() bloqueia com 422 explícito enquanto for null.
    cpf: null,
    email: "hamilton.santos@v3partners.com.br",
  },
  CONSORCIO: {
    roleLabel: "SÓCIO RESPONSÁVEL, COMPLIANCE / V3 PARTNERS",
    fullName: "Robson Lino",
    qualificacao: "brasileiro, empresário",
    cpf: null,
    email: "robson.lino@v3partners.com.br",
  },
  CREDITO_INTERNACIONAL: {
    roleLabel: "SÓCIO RESPONSÁVEL, COMPLIANCE / V3 PARTNERS",
    fullName: "Robson Lino",
    qualificacao: "brasileiro, empresário",
    cpf: null,
    email: "robson.lino@v3partners.com.br",
  },
  TRADE_FINANCE: {
    roleLabel: "SÓCIO RESPONSÁVEL, COMPLIANCE / V3 PARTNERS",
    fullName: "Robson Lino",
    qualificacao: "brasileiro, empresário",
    cpf: null,
    email: "robson.lino@v3partners.com.br",
  },
};

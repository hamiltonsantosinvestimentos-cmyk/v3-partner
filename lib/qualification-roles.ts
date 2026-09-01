import { buildLegalQualification } from "./legal-qualification";

// Rótulos de role_in_document (cm_party_qualifications), compartilhados entre
// telas client (contracts-panel-client.tsx, qualification-batches-panel.tsx)
// e rotas server (api/cm/qualifications/legal-text). Extraído em 13/08/2026
// (Fase 2) para não duplicar o dicionário num componente "use client" e
// evitar puxar dependências de UI para dentro de uma rota de API.
export const ROLE_LABELS: Record<string, string> = {
  parte_principal: "Parte Principal",
  intermediario_finder_venda: "Intermediário/Finder Venda",
  intermediario_finder_compra: "Intermediário/Finder Compra",
  mandatario: "Mandatário",
  testemunha: "Testemunha",
  // Papéis granulares da indicação rápida (13/08/2026, Fase 1) — ver
  // 20260813_qualificacoes_pf_pj_fpa.sql.
  finder_originacao_venda: "Finder/Originação Venda",
  finder_originacao_compra: "Finder/Originação Compra",
  intermediario_venda: "Intermediário Venda",
  intermediario_compra: "Intermediário Compra",
};

export interface QualificationPartyForProse {
  role_in_document: string;
  full_name: string;
  email?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  endereco_completo?: string | null;
  person_type?: "PF" | "PJ" | null;
  party_nature?: import("./legal-qualification").PartyNature | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_legal_nature?: import("./legal-qualification").CompanyLegalNature | null;
  nationality?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  representation?: import("./legal-qualification").LegalQualificationRepresentation | null;
}

// Motor de prosa unificado (01/09/2026, diretriz Dr. Athaydes): a lógica de
// qualificação civil em si (PF/PJ/Procuração/Incapaz/Espólio, recursiva
// para representação encadeada) mora em lib/legal-qualification.ts, fonte
// única compartilhada com app/api/cm/qualifications/legal-text/route.ts.
// Esta função só prefixa o papel no documento (mandatário, testemunha etc),
// mesmo formato usado desde sempre pelo NCNDA Mestre (lib/ncnda-desk-head.ts).
export function renderPartyQualificationProse(party: QualificationPartyForProse): string {
  const roleLabel = (ROLE_LABELS[party.role_in_document] ?? party.role_in_document).toUpperCase();
  return `${roleLabel}: ${buildLegalQualification(party)}`;
}

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
  cpf_cnpj?: string | null;
  rg?: string | null;
  endereco_completo?: string | null;
  person_type?: string | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  birth_date?: string | null;
}

// Mesmo par PF/PJ já usado em app/api/cm/qualifications/legal-text/route.ts
// (identBlock), reescrito em formato de prosa corrida (não bloco com <h2>)
// para uso dentro de instrumentos que já têm estrutura de cláusulas própria,
// como o NCNDA Mestre (14/08/2026, ver lib/ncnda-desk-head.ts). Extraído
// aqui em vez de duplicado, mesmo texto/regra em ambos os lugares.
export function renderPartyQualificationProse(party: QualificationPartyForProse): string {
  const roleLabel = (ROLE_LABELS[party.role_in_document] ?? party.role_in_document).toUpperCase();
  const isPJ = party.person_type === "PJ";

  if (isPJ) {
    return `${roleLabel}: ${party.company_name ?? "[RAZÃO SOCIAL NÃO INFORMADA]"}, pessoa jurídica de direito privado, inscrita no CNPJ sob o n.º ${party.company_cnpj ?? "[NÃO INFORMADO]"}, com sede na ${party.company_address ?? "[ENDEREÇO NÃO INFORMADO]"}, representada por seu sócio-administrador ${party.full_name}${party.nationality ? `, ${party.nationality}` : ""}${party.marital_status ? `, ${party.marital_status}` : ""}${party.profession ? `, ${party.profession}` : ""}, portador(a) do CPF n.º ${party.cpf_cnpj ?? "[NÃO INFORMADO]"}${party.rg ? `, RG n.º ${party.rg}` : ""}${party.endereco_completo ? `, residente e domiciliado(a) na ${party.endereco_completo}` : ""};`;
  }

  return `${roleLabel}: ${party.full_name}${party.nationality ? `, ${party.nationality}` : ""}${party.marital_status ? `, ${party.marital_status}` : ""}${party.profession ? `, ${party.profession}` : ""}${party.birth_date ? `, nascido(a) em ${new Date(party.birth_date).toLocaleDateString("pt-BR")}` : ""}, portador(a) da C.I. RG n.º ${party.rg ?? "[NÃO INFORMADO]"}, inscrito(a) no CPF sob o n.º ${party.cpf_cnpj ?? "[NÃO INFORMADO]"}${party.endereco_completo ? `, residente e domiciliado(a) na ${party.endereco_completo}` : ""}, telefone [NÃO INFORMADO], e-mail [NÃO INFORMADO];`;
}

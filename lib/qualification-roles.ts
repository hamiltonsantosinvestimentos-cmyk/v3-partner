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

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
  // Papéis do NCNDA Mestre e instrumentos com múltiplas partes numeradas do
  // mesmo tipo (03/09/2026, achado ao vivo com João e Dr. Athaydes testando
  // "Gerar Contrato" real: o dropdown não cobria o desenho de partes do
  // próprio modelo do Dr. Luis). Cada papel numerado precisa de um
  // role_in_document distinto porque o motor de variáveis resolve
  // {{<role_in_document>_nome}}/_cpf_cnpj/_rg/_endereco/_email por papel
  // (app/api/contracts/generate/route.ts) -- "mandatário 1" e "mandatário
  // 2" nunca podem compartilhar o mesmo papel, ou a segunda pessoa
  // sobrescreveria a primeira no corpo do contrato.
  estruturador: "Estruturador",
  head_mesa: "Head da Mesa",
  partner: "Partner",
  mandatario_1: "Mandatário 1",
  mandatario_2: "Mandatário 2",
  // Ampliado de 2 para 10 (11/09/2026, pedido de João: operações reais do
  // NCNDA Mestre têm mais de 2 intermediários simultâneos). O motor de
  // prosa (party_qualifications_block) já é dinâmico por parte, não por
  // slot fixo -- o cap de 2 era só deste dicionário + do CHECK constraint
  // do banco, nunca do template em si (nenhuma das 3 minutas reais que
  // usam papel numerado referencia {{intermediario_N_nome}} direto no
  // corpo, todas usam o bloco automático). Ver migration
  // 20260911c_qualificacoes_intermediarios_ate_10.sql.
  intermediario_1: "Intermediário 1",
  intermediario_2: "Intermediário 2",
  intermediario_3: "Intermediário 3",
  intermediario_4: "Intermediário 4",
  intermediario_5: "Intermediário 5",
  intermediario_6: "Intermediário 6",
  intermediario_7: "Intermediário 7",
  intermediario_8: "Intermediário 8",
  intermediario_9: "Intermediário 9",
  intermediario_10: "Intermediário 10",
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

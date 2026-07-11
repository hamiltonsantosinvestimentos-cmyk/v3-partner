// Checklists de documentos obrigatorios por tipo de ativo — Bolsa de Ativos (Marketplace de Capitais).
// Mesmo padrao de lib/checklists.ts (Mesa de Credito). Lista inicial baseada no manual tecnico
// da Bolsa de Ativos v1.4 — sujeita a validacao/ajuste por Joao/Dr. Luis Athaydes Homem.

export interface CmChecklistItem {
  id: string;
  label: string;
  required: boolean;
  hint?: string;
}

export type CmAssetType = "precatorio" | "direito_creditorio" | "cgi" | "cri" | "fidc" | "imovel" | "outros";

export const CM_DOCUMENT_CHECKLISTS: Record<CmAssetType, CmChecklistItem[]> = {
  precatorio: [
    { id: "prec_1", label: "Ofício Requisitório", required: true, hint: "Documento principal — identifica ente devedor, valor e processo" },
    { id: "prec_2", label: "Certidão de Crédito / Habilitação", required: true },
    { id: "prec_3", label: "CND Federal", required: true },
    { id: "prec_4", label: "CND Estadual", required: true },
    { id: "prec_5", label: "CND Municipal", required: true },
    { id: "prec_6", label: "Procuração", required: true },
    { id: "prec_7", label: "Contrato de Cessão", required: false, hint: "Gerado pela Mesa na fase de fechamento — não obrigatório no intake" },
  ],
  direito_creditorio: [
    { id: "dc_1", label: "Título ou Contrato de Crédito original", required: true },
    { id: "dc_2", label: "Certidão de Crédito", required: true },
    { id: "dc_3", label: "CND Federal", required: true },
    { id: "dc_4", label: "CND Estadual", required: true },
    { id: "dc_5", label: "CND Municipal", required: true },
    { id: "dc_6", label: "Procuração", required: true },
    { id: "dc_7", label: "Contrato Social + alterações (se cedente PJ)", required: true },
    { id: "dc_8", label: "Balanço Patrimonial + DRE (se cedente PJ)", required: true },
  ],
  cgi: [
    { id: "cgi_1", label: "Matrícula do imóvel atualizada (máx. 30 dias)", required: true },
    { id: "cgi_2", label: "IPTU do ano corrente", required: true },
    { id: "cgi_3", label: "Contrato de Crédito original", required: true },
    { id: "cgi_4", label: "CND Federal", required: true },
    { id: "cgi_5", label: "CND Estadual", required: true },
    { id: "cgi_6", label: "CND Municipal", required: true },
    { id: "cgi_7", label: "RG e CPF (PF) ou Contrato Social (PJ)", required: true },
  ],
  cri: [
    { id: "cri_1", label: "Escritura de Emissão do CRI", required: true },
    { id: "cri_2", label: "Termo de Securitização", required: true },
    { id: "cri_3", label: "Relatório do Agente Fiduciário", required: true },
    { id: "cri_4", label: "CND Federal, Estadual e Municipal", required: true },
  ],
  fidc: [
    { id: "fidc_1", label: "Regulamento do Fundo", required: true },
    { id: "fidc_2", label: "Relatório de Composição da Carteira", required: true },
    { id: "fidc_3", label: "Demonstrativo do Custodiante", required: true },
    { id: "fidc_4", label: "CND Federal, Estadual e Municipal", required: true },
  ],
  imovel: [
    { id: "im_1", label: "Matrícula atualizada do imóvel", required: true, hint: "Emitida em até 30 dias — o mesmo prazo já usado no checklist de CGI" },
    { id: "im_2", label: "IPTU do ano corrente", required: true },
    { id: "im_3", label: "Laudo de Vistoria Inicial", required: true, hint: "Vistoria própria da Mesa, anterior à publicação na vitrine — não confundir com a Vistoria Técnica solicitada pelo comprador na landing page pública" },
    { id: "im_4", label: "Certidões de Ônus Reais", required: true },
    { id: "im_5", label: "Comprovação de titularidade / propriedade", required: true },
    { id: "im_6", label: "Compliance PLD corporativo", required: true, hint: "Prevenção à Lavagem de Dinheiro — cedente pessoa jurídica" },
    { id: "im_7", label: "RG e CPF (PF) ou Contrato Social (PJ)", required: true },
    { id: "im_8", label: "Mandato V3 com exclusividade assinado", required: false, hint: "Gerado pela Mesa — não obrigatório no intake inicial" },
  ],
  outros: [
    { id: "out_1", label: "Documento comprobatório do ativo", required: true },
    { id: "out_2", label: "CND Federal, Estadual e Municipal", required: false },
    { id: "out_3", label: "Procuração", required: false },
  ],
};

/** Retorna o label esperado para um checklist_item_id, dado o asset_type. */
export function getCmDocLabel(checklistItemId: string, assetType: CmAssetType): string | null {
  const list = CM_DOCUMENT_CHECKLISTS[assetType] ?? CM_DOCUMENT_CHECKLISTS.outros;
  return list.find((d) => d.id === checklistItemId)?.label ?? null;
}

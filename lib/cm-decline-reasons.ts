// Motivo estruturado de declinio (Fase 5, 19/09/2026, pedido de Joao): antes
// disto, reprovar um ativo ou recusar uma proposta usava texto livre solto
// (window.prompt()), impossivel de agregar num relatorio de gargalos. Fonte
// unica pra API e UI, nunca duplicar a lista em dois lugares.

// Reprovacao do ATIVO (Etapa 4, antes de ir pra vitrine) -- decisao terminal,
// o ativo sai do funil.
export const ASSET_DECLINE_REASONS = [
  { value: "cedente_nao_aceita_carta_v3", label: "Cedente não aceita carta de intenção em nome da V3" },
  { value: "mandatario_desconhecido", label: "Mandatário desconhecido" },
  { value: "vendido_outro_escritorio", label: "Vendido por outro escritório" },
  { value: "ausencia_homologacao", label: "Ausência de homologação" },
  { value: "falta_clareza_documental", label: "Falta de clareza documental" },
  { value: "outros", label: "Outros" },
] as const;

// Recusa de PROPOSTA (Etapa 5, depois que o ativo ja esta na vitrine) --
// nunca reprova o ativo, so a oferta especifica. Ao recusar a ultima
// proposta pendente, o ativo volta sozinho pra ativo_vitrine (ver
// app/api/cm/bids/[id]/route.ts).
export const BID_DECLINE_REASONS = [
  { value: "preco_fora_mercado", label: "Preço fora de mercado" },
  { value: "outros", label: "Outros" },
] as const;

export type AssetDeclineReason = typeof ASSET_DECLINE_REASONS[number]["value"];
export type BidDeclineReason = typeof BID_DECLINE_REASONS[number]["value"];

export const ASSET_DECLINE_REASON_VALUES = ASSET_DECLINE_REASONS.map((r) => r.value);
export const BID_DECLINE_REASON_VALUES = BID_DECLINE_REASONS.map((r) => r.value);

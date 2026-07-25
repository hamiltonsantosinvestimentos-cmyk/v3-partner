export const STAGES = [
  { etapa: "fpa-compra", templateName: "FPA Compra", label: "FPA Compra", accessSide: "intermediario" },
  { etapa: "carta-intencao", templateName: "Carta de Intencao de Compra (Matching)", label: "Carta de Intenção", accessSide: "buyer" },
  { etapa: "fpa-venda", templateName: "FPA Venda (Acordo de Protecao de Honorarios)", label: "FPA Venda", accessSide: "seller" },
  { etapa: "contrato-venda", templateName: "Contrato de Compra e Venda de Ativo Naval", label: "Contrato de Venda", accessSide: "seller" },
] as const;

export type Etapa = (typeof STAGES)[number]["etapa"];

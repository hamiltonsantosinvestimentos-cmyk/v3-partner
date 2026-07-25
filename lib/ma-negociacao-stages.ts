// role: "comissionado" (intermediario que ganha 1/3 da taxa de estruturação)
// ou "contraparte" (comprador/vendedor real do ativo). Usado pelo workflow
// n8n W14 para decidir qual parágrafo explicativo entra no email de convite.
export const STAGES = [
  { etapa: "fpa-compra", templateName: "FPA Compra", label: "FPA Compra", accessSide: "intermediario", role: "comissionado" },
  { etapa: "carta-intencao", templateName: "Carta de Intencao de Compra (Matching)", label: "Carta de Intenção", accessSide: "buyer", role: "contraparte" },
  { etapa: "fpa-venda", templateName: "FPA Venda (Acordo de Protecao de Honorarios)", label: "FPA Venda", accessSide: "seller", role: "comissionado" },
  { etapa: "contrato-venda", templateName: "Contrato de Compra e Venda de Ativo Naval", label: "Contrato de Venda", accessSide: "seller", role: "contraparte" },
] as const;

export type Etapa = (typeof STAGES)[number]["etapa"];

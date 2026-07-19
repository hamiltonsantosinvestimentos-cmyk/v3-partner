import { buildDeleteHandlers } from "@/lib/governance-delete";

const { POST, PATCH } = buildDeleteHandlers({
  table: "ma_deals",
  vertical: "Mesa M&A",
  labelColumn: "target_company",
  reviewUrl: "https://app.v3partners.com.br/mesa-ma",
  requestRoles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"],
});

export { POST, PATCH };

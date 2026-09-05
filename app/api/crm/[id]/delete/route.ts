import { buildDeleteHandlers } from "@/lib/governance-delete";

const { POST, PATCH } = buildDeleteHandlers({
  table: "crm_leads",
  vertical: "CRM",
  labelColumn: "name",
  reviewUrl: "https://app.v3partners.com.br/crm",
  requestRoles: ["ADMIN", "GESTAO"],
});

export { POST, PATCH };

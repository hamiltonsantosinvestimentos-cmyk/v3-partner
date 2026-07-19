import { buildDeleteHandlers } from "@/lib/governance-delete";

const { POST, PATCH } = buildDeleteHandlers({
  table: "credit_desk_proposals",
  vertical: "Mesa de Crédito",
  labelColumn: "client_name",
  reviewUrl: "https://app.v3partners.com.br/mesa-credito",
  requestRoles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"],
});

export { POST, PATCH };

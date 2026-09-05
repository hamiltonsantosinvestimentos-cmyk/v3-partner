import { buildDeleteHandlers } from "@/lib/governance-delete";

const { POST, PATCH } = buildDeleteHandlers({
  table: "operational_tickets",
  vertical: "Mesa Operacional",
  labelColumn: "title",
  reviewUrl: "https://app.v3partners.com.br/mesa-operacional",
  requestRoles: ["ADMIN"],
});

export { POST, PATCH };

import { buildLixeiraHandlers } from "@/lib/governance-delete";

const { GET, POST } = buildLixeiraHandlers([
  { table: "credit_desk_proposals", itemType: "proposta", selectColumns: "id, code, client_name, credit_line" },
  { table: "operational_tickets", itemType: "ticket", selectColumns: "id, code, title, priority" },
]);

export { GET, POST };

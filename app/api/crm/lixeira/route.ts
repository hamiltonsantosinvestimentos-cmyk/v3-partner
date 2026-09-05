import { buildLixeiraHandlers } from "@/lib/governance-delete";

const { GET, POST } = buildLixeiraHandlers([
  { table: "crm_leads", itemType: "lead", selectColumns: "id, code, name, email, phone" },
]);

export { GET, POST };

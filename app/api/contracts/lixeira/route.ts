import { buildLixeiraHandlers } from "@/lib/governance-delete";

const { GET, POST } = buildLixeiraHandlers([
  { table: "operation_contracts", itemType: "contrato", selectColumns: "id, contract_code, contract_title, vertical, status_signature" },
]);

export { GET, POST };

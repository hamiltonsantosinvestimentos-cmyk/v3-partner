import { buildLixeiraHandlers } from "@/lib/governance-delete";

const { GET, POST } = buildLixeiraHandlers([
  { table: "ma_deals", itemType: "deal", selectColumns: "id, code, target_company, sector, deal_value" },
]);

export { GET, POST };

import { buildLixeiraHandlers } from "@/lib/governance-delete";

// Nota: consorcio_projetos e consorcio_leads não existem como tabelas reais
// no banco (verificado via list_tables em 2026-07-19) — só consorcio_cartas
// é real. As rotas de exclusão para projetos/leads foram removidas; o Kanban
// de "leads" da Mesa de Consórcio já está quebrado hoje (busca uma tabela
// inexistente), bug pré-existente e fora do escopo desta feature.
const { GET, POST } = buildLixeiraHandlers([
  { table: "consorcio_cartas", itemType: "carta", selectColumns: "id, code, group_name, credit_value" },
]);

export { GET, POST };

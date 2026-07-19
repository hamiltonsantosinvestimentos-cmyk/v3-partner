import { buildDeleteHandlers } from "@/lib/governance-delete";

const { POST, PATCH } = buildDeleteHandlers({
  table: "consorcio_cartas",
  vertical: "Mesa de Consórcio — Cartas",
  labelColumn: "code",
  reviewUrl: "https://app.v3partners.com.br/mesa-consorcio-op",
  requestRoles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"],
});

export { POST, PATCH };

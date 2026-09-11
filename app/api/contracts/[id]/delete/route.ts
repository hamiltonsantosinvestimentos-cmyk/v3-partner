import { buildDeleteHandlers } from "@/lib/governance-delete";

// 10/09/2026: mesmo padrão de soft delete + Lixeira 30 dias já em produção
// em ma_deals/credit_desk_proposals/consorcio_cartas/cm_asset_listings/
// crm_leads/operational_tickets. Guarda extra específica de contrato:
// nunca permite excluir um contrato já enviado para assinatura ou assinado
// -- só rascunho, que é justamente o caso real reportado por João (drafts
// de teste antigos que nunca chegaram a sair da Central de Contratos).
const { POST, PATCH } = buildDeleteHandlers({
  table: "operation_contracts",
  vertical: "Central de Contratos",
  labelColumn: "contract_title",
  reviewUrl: "https://app.v3partners.com.br/juridico/contratos",
  requestRoles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"],
  guardColumns: ["status_signature"],
  guard: (item) =>
    item.status_signature !== "rascunho"
      ? `Só é possível excluir contratos em rascunho (status atual: "${item.status_signature}"). Contrato já enviado/assinado precisa ser cancelado no provedor de assinatura antes -- nunca excluído por aqui.`
      : null,
});

export { POST, PATCH };

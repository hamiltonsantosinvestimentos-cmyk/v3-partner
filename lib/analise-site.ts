// Pedidos de Análise de Crédito comprados direto no site (aba "Diretos (Site)" dos Pedidos de
// Partners) precisam de uma linha em credit_desk_proposals só porque o motor de análise roda
// em cima de uma proposta. Isso NÃO é uma operação de crédito (decisão de 23/09/2026): essas
// propostas técnicas ficam fora da Mesa de Crédito, da Mesa Operacional e dos painéis.
// Marca: link-proposal grava metadata.source = "partner_service_order" + order_source = "direct".

export function ehAnaliseDoSite(p: { metadata?: unknown } | null | undefined): boolean {
  const m = (p?.metadata ?? null) as { source?: unknown; order_source?: unknown } | null;
  return m?.source === "partner_service_order" && m?.order_source === "direct";
}

/** Remove da lista as propostas técnicas de análise do site. */
export function semAnaliseDoSite<T extends { metadata?: unknown }>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter((r) => !ehAnaliseDoSite(r));
}

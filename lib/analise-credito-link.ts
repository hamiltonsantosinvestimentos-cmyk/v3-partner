// Link de venda da Análise de Crédito (Serasa/Bacen/Jurídico/Cadastro) vinculado
// a uma proposta e ao partner que a originou. Usado tanto no botão do detalhe
// da proposta (proposta-detail-modal.tsx) quanto na tela de sucesso do
// cadastro de uma nova proposta (nova-proposta-modal.tsx) — extraído aqui pra
// as duas telas não divergirem se o domínio/parâmetros mudarem.
export function buildAnaliseCreditoLink(input: { proposalCode: string; partnerId?: string | null }): string {
  const params = new URLSearchParams({ prop: input.proposalCode });
  if (input.partnerId) params.set("ref", input.partnerId);
  return `https://app.v3partners.com.br/analise-v2?${params.toString()}#configurador`;
}

// Dicionário único de verticais de contract_templates, compartilhado entre
// telas client (contract-templates-client.tsx) e rotas server (generate,
// templates/[id], templates POST). Extraído em 11/09/2026 (mesmo motivo de
// lib/qualification-roles.ts em 13/08/2026: evitar duas listas divergentes
// entre UI e validação de API), no mesmo bloco em que "multi_vertical" foi
// criado -- pedido de João: 1 minuta só (ex: NDA), com pequenos trechos que
// mudam por vertical, resolvidos na hora de gerar o contrato, em vez de 3
// minutas inteiras duplicadas (Dr. Luis/Mestre-Crédito/M&A) hoje mantidas
// à mão em paralelo.
export const VERTICAL_LABELS: Record<string, string> = {
  capital_markets: "Bolsa de Ativos",
  credito: "Mesa de Crédito",
  ma: "M&A",
  institucional: "Institucional",
  clientes: "Clientes / Partners",
  talent_pool: "Talent Pool",
  colaboradores: "Colaboradores",
  multi_vertical: "Multi-Vertical (varia por operação)",
};

// Verticais "concretas" -- alvo válido de {{v:X}}...{{/v}} no corpo de uma
// minuta multi_vertical, e única escolha aceita no dropdown "Vertical desta
// operação" do modal Gerar Contrato quando o template é multi_vertical.
// Exclui multi_vertical em si (não existe operação "multi-vertical" de
// verdade, é só o rótulo da minuta genérica).
export const CONCRETE_VERTICALS = Object.keys(VERTICAL_LABELS).filter((v) => v !== "multi_vertical");

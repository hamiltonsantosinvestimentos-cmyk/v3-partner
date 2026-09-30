import { resolveDeskHead, VERTICAL_TO_DESK_ORIGIN, isHeadGatedVertical, PENDING_PLACEHOLDER } from "@/lib/ncnda-desk-head";
import { formatCPF } from "@/lib/validators/cpf-cnpj";

// Gate do Head da Mesa antes do envio para assinatura (30/09/2026, pedido de
// João: o pré-voo precisa ter certeza de que o Head da mesa está na minuta).
// Vale só para M&A e Bolsa de Ativos. Barra também rascunhos antigos gerados
// com outro Head (Dr. Athaydes, Robson): o Head esperado é o de hoje.
// Devolve a mensagem de erro (422) ou null quando está tudo certo.
export async function checkHeadInContract(contract: {
  vertical: string;
  parties: Array<{ role: string; name: string | null; email?: string | null; doc?: string | null }> | null;
  rendered_html: string | null;
}): Promise<string | null> {
  if (!isHeadGatedVertical(contract.vertical)) return null;
  const origin = VERTICAL_TO_DESK_ORIGIN[contract.vertical];
  if (!origin) return null;

  const head = await resolveDeskHead(origin);
  if (head.pendencias.length > 0) {
    return `Contrato não pode ser enviado: o Head da Mesa (${head.fullName}) tem dado pendente em /perfil (${head.pendencias.join(", ")}). Complete o perfil e gere o contrato de novo.`;
  }

  const heads = (contract.parties ?? []).filter((p) => p.role === "head_mesa");
  if (heads.length !== 1) {
    return `Contrato não pode ser enviado: falta o Head da Mesa como signatário (esperado 1, encontrado ${heads.length}). Gere o contrato de novo.`;
  }
  const h = heads[0];
  const sameEmail = (h.email ?? "").trim().toLowerCase() === head.email.trim().toLowerCase();
  const sameName = (h.name ?? "").trim().toUpperCase() === head.fullName.trim().toUpperCase();
  if (!sameEmail || !sameName) {
    return `Contrato não pode ser enviado: o Head da Mesa no contrato (${h.name ?? "sem nome"}) não é o Head atual (${head.fullName}). Cancele o rascunho e gere de novo.`;
  }

  const html = contract.rendered_html ?? "";
  if (!html.toUpperCase().includes(head.fullName.toUpperCase())) {
    return `Contrato não pode ser enviado: o nome do Head da Mesa (${head.fullName}) não aparece no texto do contrato.`;
  }
  // Compara o CPF normalizado com a forma impressa (000.000.000-00, dígitos visíveis).
  if (head.cpf && !html.includes(formatCPF(head.cpf))) {
    return `Contrato não pode ser enviado: o CPF do Head da Mesa não aparece no texto do contrato.`;
  }
  if (html.includes(PENDING_PLACEHOLDER)) {
    return `Contrato não pode ser enviado: o texto ainda tem campo ${PENDING_PLACEHOLDER}. Complete os dados e gere o contrato de novo.`;
  }
  return null;
}

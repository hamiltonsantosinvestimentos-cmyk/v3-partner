import { flattenChain } from "@/lib/qualification-mask";

// Prova de conferência (BRIEF Trava de Liberação, seção 2.1). O servidor calcula o que é exigido a partir
// da ficha, nunca aceita a lista do navegador. A função de banco fn_liberar_qualificacao confere que cada
// item foi aberto ou revelado por QUEM LIBERA, depois do preenchimento.

export type FichaParaConferencia = {
  cpf_cnpj?: string | null;
  rg?: string | null;
  id_number?: string | null;
  representation?: unknown;
};

const temValor = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

/** Campo de identidade a revelar: id_number se houver, senão rg. null se nenhum estiver preenchido. */
function campoIdentidade(o: { rg?: unknown; id_number?: unknown }): "id_number" | "rg" | null {
  if (temValor(o.id_number)) return "id_number";
  if (temValor(o.rg)) return "rg";
  return null;
}

/** Nomes de campo exatamente como a rota de revelação os grava em cm_party_qualification_field_views. */
export function camposExigidos(ficha: FichaParaConferencia): string[] {
  const campos: string[] = [];
  if (temValor(ficha.cpf_cnpj)) campos.push("cpf_cnpj");
  const idPrincipal = campoIdentidade(ficha);
  if (idPrincipal) campos.push(idPrincipal);

  const cadeia = flattenChain(ficha.representation as Parameters<typeof flattenChain>[0]);
  cadeia.forEach((no, i) => {
    const nodeId = no.v3_client_id ? String(no.v3_client_id).toLowerCase() : "sem-id";
    const prefixo = `representacao[${i + 1}:${nodeId}]`;
    if (temValor(no.cpf_cnpj)) campos.push(`${prefixo}.cpf_cnpj`);
    const idNo = campoIdentidade(no);
    if (idNo) campos.push(`${prefixo}.${idNo}`);
  });
  return campos;
}

export type ConferenciaPayload = {
  versao_texto: string;
  documentos: string[];
  campos: string[];
  declaracoes: string[];
};

/** Declarações de comparação que o conferente precisa marcar: nome e data de nascimento (PF) ou CNPJ (PJ). */
export const DECLARACOES_VALIDAS = ["nome", "data_nascimento", "cnpj"] as const;

export const VERSAO_TEXTO_TRAVA = "2026-11-11";

/** Monta o resumo guardado em `conferencia`: só ids e nomes de campo, nunca valores. */
export function montarConferencia(documentos: string[], campos: string[], declaracoes: string[]): ConferenciaPayload {
  return { versao_texto: VERSAO_TEXTO_TRAVA, documentos, campos, declaracoes };
}

/** Declarações exigidas conforme o tipo de parte. */
export function declaracoesExigidas(personType: string | null | undefined): string[] {
  return personType === "PJ" ? ["cnpj"] : ["nome", "data_nascimento"];
}

/** Confere que as declarações recebidas cobrem as exigidas. */
export function declaracoesCompletas(recebidas: unknown, exigidas: string[]): boolean {
  if (!Array.isArray(recebidas)) return false;
  return exigidas.every((d) => recebidas.includes(d));
}

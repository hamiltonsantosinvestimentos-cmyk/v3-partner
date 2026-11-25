// Acesso a /api/ma/documents (BRIEF docs/briefs/2026-11-24_ma-documents-acesso-por-papel-e-dono.md).
// Regra única, pura: a rota só lê o banco e pergunta aqui. Antes desta regra a rota só exigia login.

/** Equipe: o mesmo conjunto de ADMIN_ROLES de /api/ma-deals. */
export const PAPEIS_EQUIPE_DOCUMENTOS = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

/** Categorias que só a equipe envia (identidade da contraparte e instrumentos). */
export const CATEGORIAS_SO_EQUIPE = ["NDA", "Contrato", "Closing"] as const;

/** Mesma lista de upload-url (CATEGORY_SUBFOLDER). */
export const CATEGORIAS_VALIDAS = ["NDA", "Teaser", "CIM", "Due_Diligence", "Propostas", "Contrato", "Closing"] as const;

export const LINK_DOCUMENTO_SEGUNDOS = 60 * 60; // 1 hora

export const MSG_SEM_PERMISSAO = "Sem permissão para os documentos deste deal.";
export const MSG_SEM_PERMISSAO_EXCLUIR = "Sem permissão para excluir documentos deste deal.";

export interface DealParaAcesso {
  assigned_to?: string | null;
  created_by?: string | null;
  deleted_at?: string | null;
}

export interface DocParaAcesso {
  doc_id: string;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
}

export function ehEquipeDocumentos(papel: string | null | undefined): boolean {
  return (PAPEIS_EQUIPE_DOCUMENTOS as readonly string[]).includes(papel ?? "");
}

/**
 * Pode ler e enviar no deal? Equipe: qualquer deal. Demais: só deal ativo em que é assigned_to ou created_by
 * (regra de dono de /api/ma-deals). Deal inexistente ou na Lixeira: não, para quem não é equipe.
 */
export function podeAcessarDeal(papel: string | null | undefined, deal: DealParaAcesso | null, userId: string): boolean {
  if (ehEquipeDocumentos(papel)) return !!deal;
  if (!deal || deal.deleted_at) return false;
  return deal.assigned_to === userId || deal.created_by === userId;
}

export function podeExcluir(papel: string | null | undefined): boolean {
  return ehEquipeDocumentos(papel);
}

/** Recorte do GET: equipe vê todos; os demais só o que eles mesmos enviaram (duplo cego). Ordem: mais recente primeiro. */
export function documentosVisiveis<T extends DocParaAcesso>(papel: string | null | undefined, docs: T[], userId: string): T[] {
  const lista = ehEquipeDocumentos(papel) ? [...docs] : docs.filter(d => !!d.uploaded_by && d.uploaded_by === userId);
  return lista.sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""));
}

/** Categoria recebida no POST: inválida (400), proibida ao perfil (403) ou ok. */
export function checarCategoria(papel: string | null | undefined, categoria: string): { ok: true } | { ok: false; status: 400 | 403; erro: string } {
  if (!(CATEGORIAS_VALIDAS as readonly string[]).includes(categoria)) {
    return { ok: false, status: 400, erro: `Categoria inválida: ${categoria}` };
  }
  if (!ehEquipeDocumentos(papel) && (CATEGORIAS_SO_EQUIPE as readonly string[]).includes(categoria)) {
    return { ok: false, status: 403, erro: `Categoria ${categoria} só pode ser enviada pela equipe da V3.` };
  }
  return { ok: true };
}

/** Substituir doc_id existente: perfil não equipe só substitui o que ele mesmo enviou (senão 409). */
export function podeSubstituir(papel: string | null | undefined, existente: DocParaAcesso | undefined, userId: string): boolean {
  if (!existente) return true;
  if (ehEquipeDocumentos(papel)) return true;
  return !!existente.uploaded_by && existente.uploaded_by === userId;
}

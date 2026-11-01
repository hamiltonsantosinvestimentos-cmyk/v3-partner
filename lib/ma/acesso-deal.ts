// Política de sigilo (31/10/2026): externo nunca lê o banco direto. O originador vê o deal e o cliente
// que originou pela aplicação, com as colunas escolhidas pela V3. Funções puras, sem acesso ao banco:
// toda saída de deal ou de cliente para partner passa por aqui (BRIEF "Fim da leitura direta de externo ao banco").

/** Perfis internos que leem deal de qualquer originador. */
export const PAPEIS_INTERNOS_DEAL = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;

export function ehPapelInternoDeal(role: string | null | undefined): boolean {
  return !!role && (PAPEIS_INTERNOS_DEAL as readonly string[]).includes(role);
}

type Linha = Record<string, unknown>;

/** Critério único de originador: originator_profile_id ou created_by. assigned_to não conta. */
export function ehOriginadorDoDeal(deal: Linha, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return deal.originator_profile_id === userId || deal.created_by === userId;
}

/** Colunas do deal que o originador recebe no detalhe (aprovadas pelo Robson em 31/10/2026). */
export const COLUNAS_DEAL_ORIGINADOR = [
  "id", "code", "v3_code", "legacy_code", "title", "description", "target_company", "sector", "location",
  "cover_photo_url", "deal_value", "ebitda_multiple", "revenue_ttm", "ebitda_ttm", "stage", "status",
  "expected_close_date", "tags", "slug", "documents", "asset_data", "origin_vertical", "contract_status",
  "contract_signed_at", "created_at", "updated_at", "buyer_name", "seller_name",
] as const;

/** Colunas mínimas da lista do originador (sem asset_data, documents, description nem identidade). */
export const COLUNAS_LISTA_ORIGINADOR = [
  "id", "code", "v3_code", "title", "target_company", "sector", "stage", "status", "deal_value",
  "ebitda_multiple", "expected_close_date", "created_at", "updated_at",
] as const;

/** Identidade da contraparte: só depois dos contratos e do mandato assinados (regra 7.3, duplo cego). */
export function contratoAssinado(deal: Linha): boolean {
  return deal.contract_status === "SIGNED";
}

function escolher(origem: Linha, colunas: readonly string[]): Linha {
  const saida: Linha = {};
  for (const c of colunas) if (c in origem) saida[c] = origem[c];
  return saida;
}

export function recorteDealParaOriginador(deal: Linha): Linha {
  const saida = escolher(deal, COLUNAS_DEAL_ORIGINADOR);
  if (!contratoAssinado(deal)) {
    saida.buyer_name = null;
    saida.seller_name = null;
  }
  return saida;
}

export function recorteListaParaOriginador(deal: Linha): Linha {
  return escolher(deal, COLUNAS_LISTA_ORIGINADOR);
}

export type LadoOriginador = "vendedor" | "comprador";

export function ladoValido(valor: unknown): LadoOriginador | null {
  return valor === "vendedor" || valor === "comprador" ? valor : null;
}

export type VinculoCliente = { role: string | null; status?: string | null; legal_name?: string | null; document_type?: string | null; document_number?: string | null };

/** Colunas do cliente que o originador recebe (aprovadas pelo Robson em 31/10/2026). */
export const COLUNAS_CLIENTE_ORIGINADOR = ["legal_name", "document_type", "document_number", "role", "status"] as const;

/**
 * Tabela de decisão fail-closed. O vínculo só sai se o lado do originador for conhecido e o papel do
 * vínculo for o mesmo lado. Papel nulo, intermediário, outro lado ou lado ausente: nada.
 */
export function clientesDoLadoDoOriginador(lado: unknown, vinculos: VinculoCliente[]): VinculoCliente[] {
  const l = ladoValido(lado);
  if (!l) return [];
  return vinculos.filter((v) => v.role === l).map((v) => escolher(v as Linha, COLUNAS_CLIENTE_ORIGINADOR) as VinculoCliente);
}

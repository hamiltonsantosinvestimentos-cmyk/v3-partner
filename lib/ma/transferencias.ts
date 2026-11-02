// Selo do card e caminho do ativo (bloco C, 30/10/2026). Função pura: recebe o cliente do banco,
// sem importar nada do Next, para poder ser testada em isolamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeskDestino, TransferenciaMesa } from "@/lib/ma/transferir-mesa-tipos";

/**
 * Registros de destino de cada deal (selo do card e caminho do ativo). Só para a equipe: o partner
 * nunca recebe este campo. O registro mais recente de cada destino vale; cancelado vem marcado.
 */
export async function anexarTransferencias<T extends { id: string }>(
  db: SupabaseClient,
  deals: T[],
): Promise<(T & { transferencias: TransferenciaMesa[] })[]> {
  const ids = deals.map((d) => d.id);
  if (ids.length === 0) return deals.map((d) => ({ ...d, transferencias: [] }));
  const [listings, propostas] = await Promise.all([
    db.from("cm_asset_listings").select("id, ma_deal_id, anonymous_id, deleted_at, created_at").in("ma_deal_id", ids),
    db.from("credit_desk_proposals").select("id, ma_deal_id, code, deleted_at, created_at").in("ma_deal_id", ids),
  ]);
  const porDeal = new Map<string, TransferenciaMesa[]>();
  const empurrar = (dealId: string, t: TransferenciaMesa) => {
    const lista = porDeal.get(dealId) ?? [];
    lista.push(t);
    porDeal.set(dealId, lista);
  };
  for (const l of (listings.data ?? []) as { id: string; ma_deal_id: string; anonymous_id: string | null; deleted_at: string | null; created_at: string }[]) {
    empurrar(l.ma_deal_id, { destino: "bolsa", registro_id: l.id, codigo: l.anonymous_id, cancelado: !!l.deleted_at, criado_em: l.created_at });
  }
  for (const c of (propostas.data ?? []) as { id: string; ma_deal_id: string; code: string | null; deleted_at: string | null; created_at: string }[]) {
    empurrar(c.ma_deal_id, { destino: "credito", registro_id: c.id, codigo: c.code, cancelado: !!c.deleted_at, criado_em: c.created_at });
  }
  return deals.map((d) => {
    const lista = (porDeal.get(d.id) ?? []).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    const vistos = new Set<DeskDestino>();
    const unicos = lista.filter((t) => (vistos.has(t.destino) ? false : (vistos.add(t.destino), true)));
    return { ...d, transferencias: unicos };
  });
}

// Filtro de colunas por papel (BRIEF Mesa M&A bloco C, segunda entrega, 01/11/2026). O registro de
// transferência não aparece para o partner originador (a transferência não grava originator_profile_id
// nem partner_id), mas as rotas de listagem devolviam todas as colunas. Aqui o corte é explícito: equipe
// recebe ma_deal_id e classificacao_pendente; qualquer outro papel não recebe ma_deal_id,
// classificacao_pendente nem metadata.transferencia. Política de sigilo 31/10/2026.
export const PAPEIS_EQUIPE_TRANSFERENCIA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

type Linha = Record<string, unknown>;

export function recortarTransferenciaPorPapel<T extends Linha>(
  row: T, role: string | null | undefined, campoCodigo: "anonymous_id" | "code",
): Linha {
  const equipe = (PAPEIS_EQUIPE_TRANSFERENCIA as readonly string[]).includes(role ?? "");
  if (equipe) {
    const vemDeTransferencia = !!row.ma_deal_id;
    return { ...row, classificacao_pendente: vemDeTransferencia && !row[campoCodigo] };
  }
  const { ma_deal_id: _d, classificacao_pendente: _c, ...resto } = row as Linha;
  void _d; void _c;
  const meta = resto.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta) && "transferencia" in (meta as Linha)) {
    const { transferencia: _t, ...metaSemTransferencia } = meta as Linha;
    void _t;
    resto.metadata = metaSemTransferencia;
  }
  return resto;
}

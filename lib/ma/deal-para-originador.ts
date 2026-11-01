// Única porta de saída de deal e de cliente de deal para o originador (política de sigilo, 31/10/2026).
// SOMENTE SERVIDOR: usa a chave de serviço. Nunca importar em componente "use client" (o teste de CI
// tests/unit/sigilo-ci.test.ts falha se isso acontecer). Perfil interno recebe o deal inteiro; partner só o
// que originou, pelas colunas aprovadas. Toda leitura de detalhe grava audit_logs ANTES de devolver o dado.
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import {
  ehPapelInternoDeal, ehOriginadorDoDeal, recorteDealParaOriginador, recorteListaParaOriginador,
  clientesDoLadoDoOriginador, COLUNAS_LISTA_ORIGINADOR, type VinculoCliente,
} from "./acesso-deal";

export function clienteDeServico(): SupabaseClient {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type Solicitante = { id: string; role: string; nome?: string | null; ip?: string | null };

type Linha = Record<string, unknown>;

async function registrarAcesso(db: SupabaseClient, s: Solicitante, entityId: string, action: string, extra?: Linha): Promise<boolean> {
  const { error } = await db.from("audit_logs").insert({
    user_id: s.id,
    user_name: s.nome ?? null,
    action,
    entity: "ma_deals",
    entity_id: entityId,
    new_data: { perfil: s.role, ...extra },
    ip_address: s.ip ?? null,
  });
  if (error) {
    console.error("[deal-para-originador] falha ao gravar log de acesso", { acao: action, code: error.code });
    return false;
  }
  return true;
}

export type ResultadoDeal =
  | { ok: true; deal: Linha; interno: boolean }
  | { ok: false; status: 401 | 404 | 500 };

/**
 * Detalhe do deal. Interno: todas as colunas. Partner: só se for originador (originator_profile_id ou
 * created_by), pelas colunas aprovadas. Qualquer outro caso: 404 genérico, sem confirmar existência.
 * Se o log não gravar, o deal não sai (500).
 */
export async function lerDealParaSolicitante(dealId: string, s: Solicitante | null, db: SupabaseClient = clienteDeServico()): Promise<ResultadoDeal> {
  if (!s) return { ok: false, status: 401 };
  const { data: deal, error } = await db.from("ma_deals").select("*").eq("id", dealId).is("deleted_at", null).maybeSingle();
  if (error) return { ok: false, status: 500 };
  if (!deal) return { ok: false, status: 404 };

  const interno = ehPapelInternoDeal(s.role);
  if (!interno && !ehOriginadorDoDeal(deal as Linha, s.id)) return { ok: false, status: 404 };

  const gravou = await registrarAcesso(db, s, dealId, interno ? "deal_lido_pela_equipe" : "deal_lido_pelo_originador");
  if (!gravou) return { ok: false, status: 500 };

  return { ok: true, interno, deal: interno ? (deal as Linha) : recorteDealParaOriginador(deal as Linha) };
}

/** Lista. Interno: o que a tela já tinha. Partner: só o que originou, colunas mínimas. */
export async function listarDealsParaSolicitante(s: Solicitante, db: SupabaseClient = clienteDeServico()): Promise<Linha[]> {
  if (ehPapelInternoDeal(s.role)) {
    const { data } = await db.from("ma_deals").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    return (data ?? []) as Linha[];
  }
  const { data } = await db
    .from("ma_deals")
    .select(COLUNAS_LISTA_ORIGINADOR.join(", ") + ", originator_profile_id, created_by")
    .is("deleted_at", null)
    .or(`originator_profile_id.eq.${s.id},created_by.eq.${s.id}`)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Linha[]).map((d) => recorteListaParaOriginador(d));
}

/**
 * Cliente do deal para o originador, fail-closed: só o vínculo do lado que ele trouxe (ma_deals.lado_originador)
 * e só depois de a Mesa classificar o papel. Registra a leitura (ou a negativa) antes de devolver.
 */
export async function lerClientesDoDealParaOriginador(
  dealId: string, s: Solicitante, db: SupabaseClient = clienteDeServico(),
): Promise<{ ok: true; clientes: VinculoCliente[] } | { ok: false; status: 404 | 500 }> {
  if (ehPapelInternoDeal(s.role)) return { ok: false, status: 404 }; // equipe usa a rota própria da Mesa
  const { data: deal } = await db.from("ma_deals").select("id, originator_profile_id, created_by, lado_originador").eq("id", dealId).is("deleted_at", null).maybeSingle();
  if (!deal || !ehOriginadorDoDeal(deal as Linha, s.id)) return { ok: false, status: 404 };

  const { data: vinculos, error } = await db
    .from("ma_deal_clients")
    .select("role, status, v3_clients(legal_name, document_type, document_number)")
    .eq("deal_id", dealId);
  if (error) return { ok: false, status: 500 };

  const planos: VinculoCliente[] = ((vinculos ?? []) as unknown as Array<{ role: string | null; status: string | null; v3_clients: { legal_name: string | null; document_type: string | null; document_number: string | null } | null }>)
    .map((v) => ({ role: v.role, status: v.status, legal_name: v.v3_clients?.legal_name ?? null, document_type: v.v3_clients?.document_type ?? null, document_number: v.v3_clients?.document_number ?? null }));

  const permitidos = clientesDoLadoDoOriginador((deal as Linha).lado_originador, planos);
  const gravou = await registrarAcesso(db, s, dealId, permitidos.length ? "cliente_do_deal_lido_pelo_originador" : "cliente_do_deal_negado", { quantidade: permitidos.length });
  if (!gravou) return { ok: false, status: 500 };
  return { ok: true, clientes: permitidos };
}

// Envelope comum das rotas /api/v1: autentica, executa, registra a chamada e converte erros.
import type { NextRequest, NextResponse } from "next/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import type { Escopo } from "@/lib/api-keys";
import { autenticar, registrarChamada, type ContextoChave } from "@/lib/api-v1/auth";
import { ErroApi, respostaErro, respostaOk } from "@/lib/api-v1/http";
import type { PortfolioLinhaDocs } from "@/lib/credit-checklists";
import { ehPartnerAccess } from "@/lib/v3-access";

export function dbServico(): SupabaseClient {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type Resultado = { status?: number; corpo: unknown; proposalId?: string | null; idempotencyKey?: string | null; headers?: Record<string, string> };

export async function executar(
  req: NextRequest,
  escopo: Escopo | null,
  rota: string,
  fn: (ctx: ContextoChave, db: SupabaseClient) => Promise<Resultado>,
): Promise<NextResponse> {
  const db = dbServico();
  let ctx: ContextoChave;
  try {
    ctx = await autenticar(db, req, escopo, rota);
  } catch (e) {
    if (e instanceof ErroApi) return respostaErro(e);
    console.error("[api-v1] falha na autenticação", e);
    return respostaErro(new ErroApi(500, "erro_interno", "Erro interno. Tente de novo em alguns minutos."));
  }
  try {
    const r = await fn(ctx, db);
    const status = r.status ?? 200;
    await registrarChamada(db, {
      keyId: ctx.keyId, partnerId: ctx.partnerId, metodo: req.method, rota, status,
      proposalId: r.proposalId ?? null, idempotencyKey: r.idempotencyKey ?? null, ip: ctx.ip,
    });
    const res = respostaOk(r.corpo, status);
    for (const [k, v] of Object.entries(r.headers ?? {})) res.headers.set(k, v);
    return res;
  } catch (e) {
    const erro = e instanceof ErroApi ? e : new ErroApi(500, "erro_interno", "Erro interno. Tente de novo em alguns minutos com a mesma Idempotency-Key.");
    if (!(e instanceof ErroApi)) console.error("[api-v1]", rota, e);
    await registrarChamada(db, { keyId: ctx.keyId, partnerId: ctx.partnerId, metodo: req.method, rota, status: erro.status, codigoErro: erro.codigo, ip: ctx.ip });
    return respostaErro(erro);
  }
}

export async function portfolioAtivo(db: SupabaseClient): Promise<PortfolioLinhaDocs[]> {
  const { data } = await db.from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true);
  return (data ?? []) as PortfolioLinhaDocs[];
}

export async function partnerAccess(db: SupabaseClient, partnerId: string): Promise<boolean> {
  return ehPartnerAccess(db, partnerId).catch(() => false);
}

/** Proposta do partner da chave, ou 404 (nunca revela que existe proposta de outro partner). */
export async function propostaDoPartner<T = Record<string, unknown>>(db: SupabaseClient, ctx: ContextoChave, id: string, colunas: string): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroApi(404, "nao_encontrada", "Proposta não encontrada.");
  const { data } = await db
    .from("credit_desk_proposals")
    .select(colunas)
    .eq("id", id)
    .eq("partner_id", ctx.partnerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new ErroApi(404, "nao_encontrada", "Proposta não encontrada.");
  return data as T;
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAudit, getClientIp } from "@/lib/audit";
import {
  acessoCommodity, camposTravadosAlterados, montarPedido, pedidoTravado, situacaoDocumentos, totalEmUnidades,
  documentosAtivos, type CommodityGravada, type ContratoResumo,
} from "@/lib/ma/commodity";

// Pedido de commodity do deal (BRIEF 2026-11-24, bloco A). Única rota que altera o pedido depois de criado.
// Papel conferido aqui, antes de qualquer uso da chave de serviço.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ deal_id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function carregar(dealId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) } as const;
  if (!UUID.test(dealId)) return { erro: NextResponse.json({ error: "Deal não encontrado" }, { status: 404 }) } as const;
  const db = svc();
  const { data: profile } = await db.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  const { data: deal } = await db
    .from("ma_deals")
    .select("id, assigned_to, created_by, asset_data, deal_value, currency")
    .eq("id", dealId)
    .is("deleted_at", null)
    .maybeSingle();
  // Sem papel de equipe: 403 mesmo que o deal não exista (não revela existência).
  const acesso = deal ? acessoCommodity(profile?.role, deal, user.id) : acessoCommodity(profile?.role, {}, user.id);
  if (!acesso) return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) } as const;
  if (!deal) return { erro: NextResponse.json({ error: "Deal não encontrado" }, { status: 404 }) } as const;
  const { data: contratos } = await db
    .from("operation_contracts")
    .select("contract_code, status_signature, deletion_status")
    .eq("deal_id", dealId);
  return { db, user, profile, deal, acesso, travado: pedidoTravado((contratos ?? []) as ContratoResumo[]) } as const;
}

function respostaPedido(commodity: Partial<CommodityGravada> | null, travado: boolean, acesso: string, deal: { deal_value: unknown; currency: unknown }) {
  return {
    commodity: commodity
      ? {
          ...commodity,
          documentos: documentosAtivos(commodity.documentos).map(d => ({
            id: d.id, tipo: d.tipo, nome: d.nome, enviado_por_nome: d.enviado_por_nome ?? null, enviado_em: d.enviado_em,
          })),
        }
      : null,
    situacao_documentos: situacaoDocumentos(commodity?.documentos),
    travado,
    pode_gravar: acesso === "gravar",
    deal_value: deal.deal_value,
    currency: deal.currency,
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { deal_id } = await ctx.params;
  const c = await carregar(deal_id);
  if ("erro" in c) return c.erro;
  const ad = (c.deal.asset_data ?? {}) as Record<string, unknown>;
  return NextResponse.json(respostaPedido((ad.commodity as CommodityGravada) ?? null, c.travado, c.acesso, c.deal));
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { deal_id } = await ctx.params;
  const c = await carregar(deal_id);
  if ("erro" in c) return c.erro;
  if (c.acesso !== "gravar") return NextResponse.json({ error: "Sem permissão para alterar o pedido" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido" }, { status: 400 }); }
  const entrada = (body as { commodity?: unknown })?.commodity;

  const ad = (c.deal.asset_data ?? {}) as Record<string, unknown>;
  const anterior = (ad.commodity as CommodityGravada | undefined) ?? null;
  const montado = montarPedido(entrada, anterior);
  if (!montado.ok) return NextResponse.json({ error: montado.erro, campos: montado.campos }, { status: 400 });

  if (c.travado) {
    const alterados = camposTravadosAlterados(anterior, montado.pedido);
    if (alterados.length > 0) {
      return NextResponse.json({
        error: "Pedido travado: há contrato enviado ou assinado. Alteração exige novo contrato.",
        campos_travados: alterados,
      }, { status: 409 });
    }
  }

  const agora = new Date().toISOString();
  const pedido: CommodityGravada = { ...montado.pedido, atualizado_em: agora, atualizado_por: c.user.id };

  // Relê o asset_data logo antes de gravar e só troca a chave commodity (não apaga transfer_history etc.).
  const { data: atual } = await c.db.from("ma_deals").select("asset_data").eq("id", deal_id).single();
  const novoAsset = { ...((atual?.asset_data ?? {}) as Record<string, unknown>), commodity: { ...pedido, documentos: ((atual?.asset_data as Record<string, unknown> | null)?.commodity as CommodityGravada | undefined)?.documentos ?? pedido.documentos ?? [] } };

  const { data: upd, error } = await c.db
    .from("ma_deals")
    .update({
      asset_data: novoAsset,
      deal_value: totalEmUnidades(pedido.valor_total_centavos),
      currency: pedido.moeda,
      updated_at: agora,
    })
    .eq("id", deal_id)
    .select("deal_value, currency")
    .single();
  if (error || !upd) {
    console.error("[commodity PATCH]", error?.message);
    return NextResponse.json({ error: "Não foi possível gravar o pedido. Tente novamente." }, { status: 500 });
  }

  const { documentos: _d1, ...antSemDocs } = anterior ?? ({} as Partial<CommodityGravada>);
  const { documentos: _d2, ...novoSemDocs } = pedido;
  void _d1; void _d2;
  await logAudit({
    userId: c.user.id, userName: c.profile?.full_name, action: "UPDATE", entity: "ma_deals", entityId: deal_id,
    oldData: { commodity: anterior ? antSemDocs : null, deal_value: c.deal.deal_value, currency: c.deal.currency },
    newData: { commodity: novoSemDocs, deal_value: upd.deal_value, currency: upd.currency },
    ipAddress: getClientIp(req), userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(respostaPedido(novoAsset.commodity as CommodityGravada, c.travado, c.acesso, upd));
}

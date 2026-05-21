import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/ma/projections/[id] — dados para charts ────────────────────────────
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: deal, error } = await db
    .from("ma_deals")
    .select("id, code, target_company, sector, deal_value, asset_data")
    .eq("id", id)
    .single();

  if (error || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  const assetData = (deal.asset_data ?? {}) as Record<string, unknown>;
  const projections = assetData.financial_projections as Record<string, unknown> | undefined;

  // Se não há projeções estruturadas, gera estrutura base a partir dos dados existentes
  if (!projections) {
    const receita2023 = assetData.receita_2023 as number | undefined;
    const receita2024 = assetData.receita_2024 as number | undefined;

    const defaultProjections = {
      receita: [
        ...(receita2023 ? [{ ano: 2023, valor: receita2023, tipo: "realizado" }] : []),
        ...(receita2024 ? [{ ano: 2024, valor: receita2024, tipo: "realizado" }] : []),
      ],
      scenarios: {
        base: { noi_anual: null, cap_rate: null, valuation: deal.deal_value },
        estabilizado: { noi_anual: null, cap_rate: null, valuation: null },
        expansao: { noi_anual: null, cap_rate: null, valuation: null },
      },
      vacancia_pct: [],
      despesas_breakdown: {},
      noi_mensal: [],
      updated_from_qa: [],
      last_updated: null,
    };

    return NextResponse.json({
      deal_id: id,
      code: deal.code,
      target_company: deal.target_company,
      sector: deal.sector,
      deal_value: deal.deal_value,
      projections: defaultProjections,
      has_structured_data: false,
    });
  }

  return NextResponse.json({
    deal_id: id,
    code: deal.code,
    target_company: deal.target_company,
    sector: deal.sector,
    deal_value: deal.deal_value,
    projections,
    has_structured_data: true,
  });
}

// ── PATCH /api/ma/projections/[id] — atualizar projeções (pós-Q&A ou manual) ───
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const body = await req.json();
  const { projections, source_thread_id } = body;

  if (!projections) return NextResponse.json({ error: "projections obrigatório" }, { status: 422 });

  // Buscar asset_data atual
  const { data: deal } = await db
    .from("ma_deals")
    .select("asset_data")
    .eq("id", id)
    .single();

  const currentAssetData = ((deal?.asset_data ?? {}) as Record<string, unknown>);
  const updatedAssetData = {
    ...currentAssetData,
    financial_projections: {
      ...projections,
      last_updated: new Date().toISOString(),
      updated_from_qa: source_thread_id
        ? [...((projections.updated_from_qa as string[] | undefined) ?? []), source_thread_id]
        : (projections.updated_from_qa ?? []),
    },
  };

  const { error } = await db
    .from("ma_deals")
    .update({ asset_data: updatedAssetData })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Se disparado por Q&A, registrar o doc update
  if (source_thread_id) {
    await db.from("deal_qa_doc_updates").insert({
      thread_id: source_thread_id,
      document_type: "forja_report",
      section_updated: "financial_projections",
      trigger_reason: "Novos dados financeiros revelados no Q&A",
      updated_by: "mesa_manual",
    });
  }

  return NextResponse.json({ updated: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCallerUserId(req: NextRequest): Promise<string | null> {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    const { data: admin } = await svc().from("profiles").select("id").eq("role", "ADMIN").limit(1).single();
    return admin?.id ?? "00000000-0000-0000-0000-000000000000";
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return user.id;
}

// POST /api/ma/investor-demands/[id]/match — executa matching e persiste resultados
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCallerUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: demandId } = await params;

  // Verifica se a demanda existe
  const { data: demand, error: demandErr } = await svc()
    .from("investor_demands")
    .select("id")
    .eq("id", demandId)
    .single();

  if (demandErr || !demand) return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });

  // Executa função de matching
  const { data: matches, error: matchErr } = await svc()
    .rpc("match_deals_for_investor", { p_demand_id: demandId });

  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });

  if (!matches || matches.length === 0) {
    return NextResponse.json({ matches: [], inserted: 0 });
  }

  // Persiste matches (upsert — ignora duplicatas)
  const rows = matches.map((m: { deal_id: string; score: number; reasons: Record<string, unknown> }) => ({
    demand_id: demandId,
    deal_id: m.deal_id,
    score: m.score,
    match_reasons: m.reasons,
    status: "novo",
  }));

  const { error: insertErr } = await svc()
    .from("demand_matches")
    .upsert(rows, { onConflict: "demand_id,deal_id", ignoreDuplicates: false });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ matches, inserted: rows.length });
}

// PATCH /api/ma/investor-demands/[id] — atualiza status ou notas
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCallerUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: demandId } = await params;
  const body = await req.json();
  const allowed = ["status", "notas", "criterios"] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nenhum campo atualizável enviado" }, { status: 422 });
  }

  const { data, error } = await svc()
    .from("investor_demands")
    .update(patch)
    .eq("id", demandId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand: data });
}

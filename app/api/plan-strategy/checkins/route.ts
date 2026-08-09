import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidSector, SECTORS } from "@/lib/sector-goals";
import { isValidCadence } from "@/lib/plan-strategy";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

async function getAuthedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const cadence = req.nextUrl.searchParams.get("cadence") ?? "";
  const period = req.nextUrl.searchParams.get("period") ?? "";
  if (!isValidCadence(cadence)) return NextResponse.json({ error: "Cadência inválida" }, { status: 400 });
  if (!period) return NextResponse.json({ error: "Período obrigatório" }, { status: 400 });

  const { data } = await serviceClient()
    .from("strategic_cadence_checkins")
    .select("*")
    .eq("cadence", cadence)
    .eq("period_label", period);

  const bySector: Record<string, unknown> = {};
  for (const s of SECTORS) {
    bySector[s] = (data ?? []).find(r => r.sector === s) ?? {
      sector: s, cadence, period_label: period,
      status: "PENDENTE", summary: "", blockers: "", next_actions: "",
    };
  }

  return NextResponse.json({ data: bySector });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { sector, cadence, period_label, status, summary, blockers, next_actions } = body;

  if (!isValidSector(sector)) return NextResponse.json({ error: "Setor inválido" }, { status: 400 });
  if (!isValidCadence(cadence)) return NextResponse.json({ error: "Cadência inválida" }, { status: 400 });
  if (!period_label) return NextResponse.json({ error: "Período obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("strategic_cadence_checkins").upsert({
    sector, cadence, period_label,
    status: status ?? "PENDENTE",
    summary: summary ?? "",
    blockers: blockers ?? "",
    next_actions: next_actions ?? "",
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "sector,cadence,period_label" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const upsertSchema = z.object({
  partner_id:     z.string().uuid(),
  year:           z.number().int().min(2020).max(2100),
  month:          z.number().int().min(1).max(12),
  goal_proposals: z.number().int().min(0).default(0),
  goal_approvals: z.number().int().min(0).default(0),
  goal_volume:    z.number().min(0).default(0),
  goal_deals:     z.number().int().min(0).default(0),
});

// GET — metas de um partner no período
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get("partner_id") ?? user.id;
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const isAdmin = ["ADMIN", "GESTAO"].includes(profile?.role ?? "");
  if (!isAdmin && partnerId !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data } = await serviceClient()
    .from("partner_goals")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  return NextResponse.json({ goal: data ?? null });
}

// POST — define/atualiza metas (ADMIN/GESTAO only)
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("partner_goals")
    .upsert({ ...parsed.data, created_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "partner_id,year,month" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, goal: data });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "SDR", "CLOSER", "GESTAO"];

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return p as { id: string; role: string; full_name: string } | null;
}

/** GET /api/prospeccao/[id]/followups */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getUser();
  if (!me || !ALLOWED.includes(me.role)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await svc()
    .from("prospeccao_followups")
    .select("id, tipo, notas, created_at, created_by, responsavel:profiles!prospeccao_followups_created_by_fkey(full_name)")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ followups: data ?? [] });
}

/** POST /api/prospeccao/[id]/followups */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getUser();
  if (!me || !ALLOWED.includes(me.role)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { tipo, notas } = await req.json() as { tipo: string; notas: string };
  if (!tipo) return NextResponse.json({ error: "tipo obrigatório" }, { status: 400 });

  const { data, error } = await svc()
    .from("prospeccao_followups")
    .insert({ lead_id: id, tipo, notas: notas || null, created_by: me.id })
    .select("id, tipo, notas, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ followup: data }, { status: 201 });
}

/** DELETE /api/prospeccao/[id]/followups?followup_id=xxx */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const me = await getUser();
  if (!me || !ALLOWED.includes(me.role)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const followupId = new URL(req.url).searchParams.get("followup_id");
  if (!followupId) return NextResponse.json({ error: "followup_id obrigatório" }, { status: 400 });

  const { error } = await svc().from("prospeccao_followups").delete().eq("id", followupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

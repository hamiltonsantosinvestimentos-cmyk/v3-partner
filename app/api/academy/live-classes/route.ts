import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

// GET — lista aulas ao vivo (passadas e futuras) com contagem de inscritos e se o usuário está inscrito
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: classes, error } = await db
    .from("academy_live_classes")
    .select("*")
    .order("date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: regs } = await db
    .from("academy_live_registrations")
    .select("live_class_id, partner_id");

  const countByClass = new Map<string, number>();
  const myRegs = new Set<string>();
  for (const r of regs ?? []) {
    countByClass.set(r.live_class_id, (countByClass.get(r.live_class_id) ?? 0) + 1);
    if (r.partner_id === user.id) myRegs.add(r.live_class_id);
  }

  const result = (classes ?? []).map((c) => ({
    ...c,
    registered_count: countByClass.get(c.id) ?? 0,
    is_registered: myRegs.has(c.id),
  }));

  return NextResponse.json({ classes: result });
}

// POST — cria uma nova aula ao vivo (admin)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json() as {
    title: string; description?: string; instructor?: string; category?: string;
    date: string; duration_min?: number; level?: string; total_spots?: number; zoom_link?: string;
  };
  if (!body.title || !body.date) return NextResponse.json({ error: "title e date são obrigatórios" }, { status: 400 });

  const { data, error } = await svc().from("academy_live_classes").insert({
    ...body,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, live_class: data });
}

// PATCH — edita uma aula ao vivo (admin) — inclui setar zoom_link e, depois, recording_url
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id, ...fields } = await req.json() as { id: string; [key: string]: unknown };
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await svc().from("academy_live_classes").update({
    ...fields,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE ?id=X — remove uma aula ao vivo (admin)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await svc().from("academy_live_classes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

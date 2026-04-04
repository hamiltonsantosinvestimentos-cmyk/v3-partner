import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return { user, profile, supabase };
}

// GET — lista todos os registros de um tipo
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  let query = supabase.from("financeiro_records").select("*").order("created_at", { ascending: true });
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

// POST — cria novo registro
export async function POST(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { type, data } = body;
  if (!type || !data) return NextResponse.json({ error: "type e data obrigatórios" }, { status: 400 });

  const { data: record, error } = await serviceClient().from("financeiro_records").insert({
    type,
    data,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, record });
}

// PATCH — atualiza registro existente
export async function PATCH(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, data } = body;
  if (!id || !data) return NextResponse.json({ error: "id e data obrigatórios" }, { status: 400 });

  const { error } = await serviceClient().from("financeiro_records").update({ data }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove registro (ADMIN e FINANCEIRO)
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão para excluir" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("financeiro_records").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

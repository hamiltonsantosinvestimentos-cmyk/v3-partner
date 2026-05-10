import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const svc = sc(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await svc.from("profiles").select("role").eq("id", user.id).single();
    return (data?.role as string) ?? null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const admin = new URL(req.url).searchParams.get("admin") === "1";
  let q = svc.from("portfolio_linhas").select("*").order("ordem", { ascending: true }).order("nome", { ascending: true });
  if (!admin) q = (q as typeof q).eq("ativo", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linhas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const role = await getRole();
  if (!["ADMIN", "GESTAO"].includes(role ?? ""))
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await svc.from("portfolio_linhas").insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linha: data });
}

export async function PATCH(req: NextRequest) {
  const role = await getRole();
  if (!["ADMIN", "GESTAO"].includes(role ?? ""))
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { data, error } = await svc
    .from("portfolio_linhas")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linha: data });
}

export async function DELETE(req: NextRequest) {
  const role = await getRole();
  if (!["ADMIN", "GESTAO"].includes(role ?? ""))
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await svc.from("portfolio_linhas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

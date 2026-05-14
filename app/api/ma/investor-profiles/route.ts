import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function authCheck() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = svc();
  const { data: p } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(p?.role ?? "")) return null;
  return user;
}

/** GET /api/ma/investor-profiles — lista investidores */
export async function GET(req: NextRequest) {
  const user = await authCheck();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const setor = searchParams.get("setor");
  const uf    = searchParams.get("uf");

  const db = svc();
  let query = db.from("investor_profiles")
    .select("*")
    .eq("status", "ativo")
    .order("created_at", { ascending: false });

  if (setor) query = query.contains("setores", [setor]);
  if (uf)    query = query.contains("ufs", [uf]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investors: data ?? [] });
}

/** POST /api/ma/investor-profiles — cria ou atualiza investidor */
export async function POST(req: NextRequest) {
  const user = await authCheck();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    id?: string;
    nome: string;
    email?: string;
    telefone?: string;
    tipo?: string;
    setores?: string[];
    ufs?: string[];
    ticket_min?: number;
    ticket_max?: number;
    tipos_operacao?: string[];
    criterios?: string;
    origem?: string;
    notas?: string;
    status?: string;
  };

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });
  }

  const db = svc();
  const payload = {
    nome:           body.nome.trim(),
    email:          body.email?.trim() || null,
    telefone:       body.telefone?.trim() || null,
    tipo:           body.tipo ?? "outro",
    setores:        body.setores ?? [],
    ufs:            body.ufs ?? [],
    ticket_min:     body.ticket_min ?? null,
    ticket_max:     body.ticket_max ?? null,
    tipos_operacao: body.tipos_operacao ?? [],
    criterios:      body.criterios?.trim() || null,
    origem:         body.origem ?? "manual",
    notas:          body.notas?.trim() || null,
    status:         body.status ?? "ativo",
    created_by:     user.id,
  };

  const { data, error } = body.id
    ? await db.from("investor_profiles").update(payload).eq("id", body.id).select().single()
    : await db.from("investor_profiles").insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, investor: data });
}

/** DELETE /api/ma/investor-profiles?id=... — desativa investidor */
export async function DELETE(req: NextRequest) {
  const user = await authCheck();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const db = svc();
  const { error } = await db.from("investor_profiles")
    .update({ status: "inativo" }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

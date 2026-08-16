import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user };
}

// POST — cria nova etapa ao final do fluxo
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as { titulo?: string; objetivo?: string; instrucoes?: string };
  if (!body.titulo?.trim()) return NextResponse.json({ error: "titulo é obrigatório" }, { status: 400 });

  const { data: maxRow } = await svc()
    .from("sdr_flow_stages")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: stage, error } = await svc()
    .from("sdr_flow_stages")
    .insert({
      ordem: (maxRow?.ordem ?? 0) + 1,
      titulo: body.titulo.trim(),
      objetivo: body.objetivo?.trim() ?? "",
      instrucoes: body.instrucoes?.trim() ?? "",
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stage });
}

// PATCH — atualiza uma etapa, ou reordena todas (body: { reorder: string[] } com ids na nova ordem)
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    id?: string;
    titulo?: string;
    objetivo?: string;
    instrucoes?: string;
    ativo?: boolean;
    reorder?: string[];
  };

  if (body.reorder) {
    await Promise.all(
      body.reorder.map((id, idx) =>
        svc().from("sdr_flow_stages").update({ ordem: idx + 1, updated_at: new Date().toISOString() }).eq("id", id)
      )
    );
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.titulo !== undefined) update.titulo = body.titulo;
  if (body.objetivo !== undefined) update.objetivo = body.objetivo;
  if (body.instrucoes !== undefined) update.instrucoes = body.instrucoes;
  if (body.ativo !== undefined) update.ativo = body.ativo;

  const { error } = await svc().from("sdr_flow_stages").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE — remove uma etapa
export async function DELETE(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await svc().from("sdr_flow_stages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

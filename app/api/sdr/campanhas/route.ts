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
  return { user, profile };
}

// GET — lista campanhas
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: campanhas } = await svc()
    .from("sdr_campanhas")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ campanhas: campanhas ?? [] });
}

// POST — cria campanha
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    nome: string;
    assunto: string;
    template_html: string;
    contatos?: Array<{ email: string; nome?: string }>;
  };

  if (!body.nome || !body.assunto || !body.template_html) {
    return NextResponse.json({ error: "nome, assunto e template_html são obrigatórios" }, { status: 400 });
  }

  const { data: campanha, error } = await svc()
    .from("sdr_campanhas")
    .insert({
      nome: body.nome,
      assunto: body.assunto,
      template_html: body.template_html,
      status: "rascunho",
      total_contatos: body.contatos?.length ?? 0,
      created_by: auth.user.id,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insere contatos se fornecidos
  if (body.contatos && body.contatos.length > 0) {
    const rows = body.contatos.map(c => ({
      campanha_id: campanha.id,
      email: c.email.toLowerCase().trim(),
      nome: c.nome ?? null,
      status: "pendente",
      track_token: crypto.randomUUID(),
    }));
    await svc().from("sdr_campanha_contatos").insert(rows);
  }

  return NextResponse.json({ campanha });
}

// PATCH — atualiza campanha
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as { id: string; nome?: string; assunto?: string; template_html?: string; contatos?: Array<{ email: string; nome?: string }> };
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.nome !== undefined) update.nome = body.nome;
  if (body.assunto !== undefined) update.assunto = body.assunto;
  if (body.template_html !== undefined) update.template_html = body.template_html;

  if (Object.keys(update).length > 0) {
    await svc().from("sdr_campanhas").update(update).eq("id", body.id);
  }

  // Substitui contatos se fornecidos
  if (body.contatos) {
    await svc().from("sdr_campanha_contatos").delete().eq("campanha_id", body.id);
    if (body.contatos.length > 0) {
      const rows = body.contatos.map(c => ({
        campanha_id: body.id,
        email: c.email.toLowerCase().trim(),
        nome: c.nome ?? null,
        status: "pendente",
        track_token: crypto.randomUUID(),
      }));
      await svc().from("sdr_campanha_contatos").insert(rows);
    }
    await svc().from("sdr_campanhas").update({ total_contatos: body.contatos.length }).eq("id", body.id);
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove campanha
export async function DELETE(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await svc().from("sdr_campanha_contatos").delete().eq("campanha_id", id);
  await svc().from("sdr_campanhas").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}

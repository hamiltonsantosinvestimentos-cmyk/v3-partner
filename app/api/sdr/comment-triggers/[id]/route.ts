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

// PATCH — edita/ativa/desativa um gatilho
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const body = await req.json() as {
    nome?: string;
    media_id?: string | null;
    media_url?: string | null;
    palavras_chave?: string[];
    mensagem_dm?: string;
    resposta_publica?: string | null;
    ativo?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (body.nome !== undefined) updates.nome = body.nome.trim();
  if (body.media_id !== undefined) updates.media_id = body.media_id?.trim() || null;
  if (body.media_url !== undefined) updates.media_url = body.media_url?.trim() || null;
  if (body.palavras_chave !== undefined) updates.palavras_chave = body.palavras_chave.map((p) => p.trim()).filter(Boolean);
  if (body.mensagem_dm !== undefined) updates.mensagem_dm = body.mensagem_dm.trim();
  if (body.resposta_publica !== undefined) updates.resposta_publica = body.resposta_publica?.trim() || null;
  if (body.ativo !== undefined) updates.ativo = body.ativo;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data, error } = await svc()
    .from("sdr_comment_triggers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trigger: data });
}

// DELETE — remove o gatilho
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const { error } = await svc().from("sdr_comment_triggers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

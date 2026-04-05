import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

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

// POST — adiciona comentário da mesa
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isMesa = MESA_ROLES.includes(profile?.role as typeof MESA_ROLES[number]);
  if (!isMesa) return NextResponse.json({ error: "Apenas a Mesa pode adicionar comentários" }, { status: 403 });

  const body = await req.json();
  const { proposal_id, text } = body;
  if (!proposal_id || !text?.trim()) {
    return NextResponse.json({ error: "proposal_id e text são obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, mesa_comments")
    .eq("id", proposal_id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const existing = Array.isArray(proposal.mesa_comments) ? proposal.mesa_comments : [];
  const newComment = {
    id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    author: profile?.full_name ?? "Mesa",
    created_at: new Date().toISOString(),
  };

  const updated = [...existing, newComment];
  const { error } = await svc
    .from("credit_desk_proposals")
    .update({ mesa_comments: updated })
    .eq("id", proposal_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, comment: newComment });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "PARTNER", "PARTNER_PRO"] as const;

// PATCH — salva estado do checklist (quais docs foram marcados)
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { proposal_id, checklist } = body;

  if (!proposal_id || typeof checklist !== "object") {
    return NextResponse.json({ error: "proposal_id e checklist obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id")
    .eq("id", proposal_id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile?.role ?? "");
  if (!isAdmin && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { error } = await svc
    .from("credit_desk_proposals")
    .update({ checklist, updated_at: new Date().toISOString() })
    .eq("id", proposal_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

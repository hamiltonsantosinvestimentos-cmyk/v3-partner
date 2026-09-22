import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { excluirAnalises, impactoDaExclusao } from "@/lib/credit-analysis-delete";

export const dynamic = "force-dynamic";

// Ação destrutiva sobre dado de crédito (Serasa/BACEN pagos): só ADMIN e GESTAO.
const ALLOWED_ROLES = ["ADMIN", "GESTAO"] as const;

async function autorizar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return { erro: NextResponse.json({ error: "Apenas ADMIN e GESTAO podem excluir análises" }, { status: 403 }) };
  }
  return { user, nome: (profile.full_name as string | null) ?? null };
}

const db = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET ?proposal_id= — o que será apagado (para a confirmação na tela). Não altera nada.
export async function GET(req: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const proposalId = new URL(req.url).searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const r = await impactoDaExclusao(db(), proposalId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}

// DELETE ?proposal_id= — exclui as análises da proposta (e dossiês/relatório que nasceram delas)
export async function DELETE(req: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const proposalId = new URL(req.url).searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const r = await excluirAnalises(db(), proposalId, { userId: a.user!.id, userName: a.nome });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, ...r });
}

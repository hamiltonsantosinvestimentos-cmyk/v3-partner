import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, name: profile.full_name ?? "Usuário", role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const contractId = new URL(req.url).searchParams.get("contract_id");
  if (!contractId) return NextResponse.json({ error: "contract_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("contract_notes")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { contract_id, content, note_type, decision } = await req.json();

  if (!contract_id || !content)
    return NextResponse.json({ error: "contract_id e content obrigatórios" }, { status: 422 });

  if (decision === "aprovado" || decision === "reprovado") {
    if (!["ADMIN"].includes(caller.role))
      return NextResponse.json({ error: "Apenas ADMIN pode aprovar/reprovar" }, { status: 403 });

    const newStatus = decision === "aprovado" ? "enviado_assinatura" : "rascunho";
    await svc()
      .from("operation_contracts")
      .update({ status_signature: newStatus })
      .eq("id", contract_id);
  }

  const { data, error } = await svc()
    .from("contract_notes")
    .insert({
      contract_id,
      author_id: caller.userId,
      author_name: caller.name,
      note_type: note_type ?? "comentario",
      content,
      decision: decision ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}

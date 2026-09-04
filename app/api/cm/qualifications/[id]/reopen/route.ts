import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function requireMesa() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return user.id;
}

// POST /api/cm/qualifications/[id]/reopen — "Reabrir para Correção"
// (04/09/2026, achado real: Iuri Nathan Dalvi preencheu dados errados/
// trocados com outro envolvido do mesmo lote, e não havia nenhum jeito de
// corrigir depois de "preenchido" — o link público trava com 409 e o
// painel admin não tinha edição nem reset). Reseta o MESMO
// qualification_token pra pendente, sem gerar link novo: a pessoa reabre
// o link que já recebeu e reenvia os dados certos.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMesa();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = svc();

  const { data: qualification } = await db
    .from("cm_party_qualifications")
    .select("id, batch_id, status, full_name")
    .eq("id", id)
    .single();

  if (!qualification) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404 });
  if (qualification.status !== "preenchido") {
    return NextResponse.json({ error: "Só é possível reabrir uma qualificação já preenchida." }, { status: 409 });
  }

  // Trava de segurança: se o lote já foi consumido por um contrato real
  // (dados já herdados no texto gerado), reabrir corrigiria o cadastro sem
  // corrigir o contrato já emitido — risco de o documento e o cadastro
  // divergirem silenciosamente. Bloqueia e explica o caminho certo.
  const { data: batch } = await db
    .from("cm_qualification_batches")
    .select("id, status, consumido_por_contract_id")
    .eq("id", qualification.batch_id)
    .single();

  if (batch?.consumido_por_contract_id) {
    return NextResponse.json({
      error: "Este lote já foi consumido por um contrato gerado. Corrigir aqui não afeta o texto já emitido — edite o contrato diretamente em Contratos Gerados, ou gere um novo contrato após corrigir uma nova qualificação.",
    }, { status: 409 });
  }

  const { error: updateError } = await db
    .from("cm_party_qualifications")
    .update({ status: "pendente", filled_at: null })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Se o lote já estava "completo" (todos preenchidos), volta a "coletando"
  // -- reabrir 1 parte significa que o lote deixou de estar 100% pronto.
  if (batch?.status === "completo") {
    await db.from("cm_qualification_batches").update({ status: "coletando", completed_at: null }).eq("id", qualification.batch_id);
  }

  return NextResponse.json({ success: true, full_name: qualification.full_name });
}

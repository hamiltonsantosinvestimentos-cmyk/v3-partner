import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { COMMISSION_TOKEN_DAYS, commissionLink, type CommissionGroup } from "@/lib/commission-grid";
import { newGridToken, sendGridInvite } from "@/lib/commission-grid-server";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Reabrir uma grade já enviada: motivo obrigatório, NOVO token e prazo renovado, o token anterior deixa de valer.
// A grade antiga fica como "substituido" (histórico preservado) e a nova nasce pendente com os mesmos participantes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({ reason: "" }));
  if (typeof reason !== "string" || reason.trim().length < 5) {
    return NextResponse.json({ error: "Motivo obrigatório: mínimo 5 caracteres." }, { status: 422 });
  }

  const { data: grid } = await db.from("cm_commission_grids").select("*").eq("id", id).maybeSingle();
  if (!grid) return NextResponse.json({ error: "Grade não encontrada." }, { status: 404 });
  if (grid.status !== "enviado") return NextResponse.json({ error: "Só é possível reabrir uma grade já enviada." }, { status: 409 });

  const logEntry = { at: new Date().toISOString(), by: (profile.full_name as string) ?? "Usuário", reason: reason.trim() };
  // Atômico: só substitui se ainda estiver "enviado".
  const { data: replaced, error: repErr } = await db
    .from("cm_commission_grids")
    .update({ status: "substituido", reopen_log: [...((grid.reopen_log as unknown[]) ?? []), logEntry] })
    .eq("id", id)
    .eq("status", "enviado")
    .select("id")
    .maybeSingle();
  if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 });
  if (!replaced) return NextResponse.json({ error: "A grade mudou de estado. Recarregue a tela." }, { status: 409 });

  const token = newGridToken();
  const { data: created, error } = await db
    .from("cm_commission_grids")
    .insert({
      token,
      group_code: grid.group_code,
      group_percent: grid.group_percent,
      source_contract_id: grid.source_contract_id,
      participants: grid.participants,
      fixed_allocations: grid.fixed_allocations,
      representative_name: grid.representative_name,
      representative_email: grid.representative_email,
      representative_phone: grid.representative_phone,
      reopened_count: (grid.reopened_count as number) + 1,
      reopen_log: [...((grid.reopen_log as unknown[]) ?? []), logEntry],
      token_expires_at: new Date(Date.now() + COMMISSION_TOKEN_DAYS * 24 * 3600 * 1000).toISOString(),
      created_by: user.id,
    })
    .select("id, token")
    .single();
  if (error || !created) {
    // Desfaz a substituição para a grade não ficar sem ativa.
    await db.from("cm_commission_grids").update({ status: "enviado" }).eq("id", id);
    return NextResponse.json({ error: error?.message ?? "Erro ao reabrir a grade." }, { status: 500 });
  }

  const emailSent = grid.representative_email
    ? await sendGridInvite({ to: grid.representative_email as string, name: grid.representative_name as string, group: grid.group_code as CommissionGroup, token })
    : false;
  return NextResponse.json({ id: created.id, link: commissionLink(created.token as string), email_sent: emailSent }, { status: 201 });
}

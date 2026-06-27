import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "SDR", "CLOSER", "GESTAO"];

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return profile as { id: string; role: string; full_name: string } | null;
}

const ETAPAS = ["prospect", "contatado", "interessado", "trial", "convertido", "perdido"];

async function processarRecompensaIndicacao(db: ReturnType<typeof svc>, leadId: string) {
  try {
    const { data: lead } = await db
      .from("prospeccao_leads")
      .select("email, indicado_por_partner_id")
      .eq("id", leadId)
      .single();

    if (!lead || !(lead as { indicado_por_partner_id?: string | null }).indicado_por_partner_id) return;

    const referrerId = (lead as { indicado_por_partner_id: string }).indicado_por_partner_id;
    const leadEmail  = (lead as { email: string | null }).email;

    // Vincular o partner recém-convertido ao seu referenciador
    if (leadEmail) {
      await db
        .from("profiles")
        .update({ referred_by_partner_id: referrerId })
        .eq("email", leadEmail.toLowerCase());
    }

    // Dar ao referenciador 10% de desconto por 6 meses (acumula se já tiver)
    const { data: referrer } = await db
      .from("profiles")
      .select("referral_discount_months_remaining")
      .eq("id", referrerId)
      .single();

    const mesesRestantes = (referrer as { referral_discount_months_remaining: number } | null)
      ?.referral_discount_months_remaining ?? 0;

    await db.from("profiles").update({
      referral_discount_percent:          10,
      referral_discount_months_remaining: mesesRestantes + 6,
    }).eq("id", referrerId);

    // Notificar o referenciador
    await db.from("notifications").insert({
      user_id:    referrerId,
      type:       "commission",
      title:      "Indicação convertida! 🎉",
      message:    "Sua indicação foi ativada. Você ganhou 10% de desconto na mensalidade por 6 meses.",
      action_url: "/indicacoes",
      read:       false,
    }).then(null, () => {});
  } catch (e) {
    console.error("Erro ao processar recompensa de indicação:", e);
  }
}

/** PATCH /api/prospeccao/[id] — atualiza etapa, responsável, notas, dados */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getUser();
  if (!me || !ALLOWED_ROLES.includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const db = svc();

  // Busca lead atual para histórico
  const { data: atual } = await db
    .from("prospeccao_leads")
    .select("etapa, nome")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = {};

  // Campos editáveis
  const campos = [
    "nome", "documento", "email", "telefone", "cidade", "estado",
    "origem", "indicado_por_partner_id", "indicado_por_nome",
    "responsavel_id", "responsavel_nome", "notas", "motivo_perda",
  ];
  for (const c of campos) {
    if (c in body) updates[c] = body[c] ?? null;
  }

  // Mudança de etapa
  if (body.etapa && ETAPAS.includes(body.etapa) && body.etapa !== (atual as { etapa: string } | null)?.etapa) {
    updates.etapa = body.etapa;
    if (body.etapa === "convertido") updates.convertido_em = new Date().toISOString();

    // Histórico
    await db.from("prospeccao_historico").insert({
      lead_id: id,
      etapa_anterior: (atual as { etapa: string } | null)?.etapa ?? null,
      etapa_nova: body.etapa,
      nota: body.nota_historico ?? null,
      created_by: me.id,
    });

    // Recompensas de indicação quando lead converte
    if (body.etapa === "convertido") {
      await processarRecompensaIndicacao(db, id);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data, error } = await db
    .from("prospeccao_leads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

/** DELETE /api/prospeccao/[id] — remove prospect (ADMIN only) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode deletar" }, { status: 403 });
  }

  const { error } = await svc().from("prospeccao_leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

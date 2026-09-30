import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MOVEMENT_STAGES } from "@/lib/movement-email";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VIEW_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const RESEND_ROLES = ["ADMIN", "GESTAO"];

// GET /api/cm/listings/[id]/movement-emails (30/09/2026, Entrega 2): lista dos e-mails de
// movimentação deste ativo, para a seção "E-mails de movimentação" no detalhe do ativo.
// Ordem: mais recente primeiro (created_at decrescente), desempate pelo e-mail do destinatário
// (localeCompare pt-BR). Partner não acessa.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as string | undefined;
  if (!role || !VIEW_ROLES.includes(role)) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const [{ data: rows, error }, { data: flag }] = await Promise.all([
    db
      .from("cm_movement_email_outbox")
      .select("id, recipient_email, recipient_name, recipient_role, status, attempts, sent_at, error, ignore_reason, created_at, cm_status_transitions(to_status, created_at)")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
    db.from("cm_feature_flags").select("enabled").eq("key", "movement_emails").maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = NonNullable<typeof rows>[number];
  const transitionOf = (r: Row) => {
    const t = r.cm_status_transitions as unknown as { to_status: string; created_at: string } | { to_status: string; created_at: string }[] | null;
    return Array.isArray(t) ? t[0] : t;
  };

  const emails = (rows ?? [])
    .map((r) => {
      const t = transitionOf(r);
      return {
        id: r.id,
        recipient_email: r.recipient_email,
        recipient_name: r.recipient_name,
        recipient_role: r.recipient_role,
        status: r.status,
        attempts: r.attempts,
        sent_at: r.sent_at,
        error: r.error,
        ignore_reason: r.ignore_reason,
        created_at: r.created_at,
        stage_label: t ? (MOVEMENT_STAGES[t.to_status]?.label ?? t.to_status) : null,
      };
    })
    .sort((a, b) => {
      const byDate = b.created_at.localeCompare(a.created_at);
      return byDate !== 0 ? byDate : a.recipient_email.localeCompare(b.recipient_email, "pt-BR");
    });

  return NextResponse.json({ emails, can_resend: RESEND_ROLES.includes(role), enabled: !!flag?.enabled });
}

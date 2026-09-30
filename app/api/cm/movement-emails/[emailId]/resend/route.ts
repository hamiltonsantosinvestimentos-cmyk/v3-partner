import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { dispatchMovementEmails } from "@/lib/movement-email";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST /api/cm/movement-emails/[emailId]/resend (30/09/2026, Entrega 2): reenvia um e-mail de
// movimentação que falhou. Só ADMIN e GESTAO. Dispara e-mail externo, por isso a tela pede
// confirmação. Nunca reenvia o que já foi enviado nem o que foi ignorado (ativo de teste).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ emailId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { emailId } = await params;
  const { data: row } = await db
    .from("cm_movement_email_outbox")
    .select("id, listing_id, status")
    .eq("id", emailId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "E-mail não encontrado" }, { status: 404 });
  if (row.status !== "falhou" && row.status !== "pendente") {
    return NextResponse.json({ error: `Só é possível reenviar e-mail com falha ou pendente (estado atual: ${row.status}).` }, { status: 409 });
  }

  const { data: flag } = await db.from("cm_feature_flags").select("enabled").eq("key", "movement_emails").maybeSingle();
  if (!flag?.enabled) {
    return NextResponse.json({ error: "O envio de e-mails de movimentação está desligado. Ligue a chave movement_emails antes de reenviar." }, { status: 409 });
  }

  // UPDATE condicional: só reabre se continua falhou ou pendente.
  const { data: reopened, error } = await db
    .from("cm_movement_email_outbox")
    .update({ status: "pendente", attempts: 0, error: null })
    .eq("id", emailId)
    .in("status", ["falhou", "pendente"])
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reopened) return NextResponse.json({ error: "O e-mail mudou de estado. Recarregue a tela." }, { status: 409 });

  after(() => dispatchMovementEmails({ listingId: row.listing_id as string }));
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// GET /api/cm/listings/[id]/communications-log — histórico de e-mails
// institucionais disparados pela Forja Jurídico para este ativo (Etapa 7,
// 21/08/2026). Lê cm_communications_log, populada pelo workflow n8n
// W-CM-Email após cada disparo real (Resend).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;

  const { data, error } = await db
    .from("cm_communications_log")
    .select("id, template_key, sender_key, sender_email, recipient_email, subject, status, error_message, sent_at, sent_by")
    .eq("listing_id", id)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data ?? [] });
}

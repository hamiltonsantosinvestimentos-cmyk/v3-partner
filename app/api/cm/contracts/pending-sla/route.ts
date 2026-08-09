import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// GET /api/cm/contracts/pending-sla — agregado leve por ativo (listing_id):
// pior SLA em horas + contagem de contratos pendentes de assinatura, para o
// badge do Kanban da Bolsa de Capitais. O detalhe (quem falta assinar,
// reenvio) fica na aba Governança (GET /api/cm/listings/[id]/contracts).
export async function GET(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await svc()
    .from("operation_contracts")
    .select("listing_id, sent_to_signature_at, updated_at")
    .eq("vertical", "capital_markets")
    .not("listing_id", "is", null)
    .not("status_signature", "in", "(assinado,cancelado,rascunho)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const byListing = new Map<string, { hours: number; count: number }>();

  for (const row of data ?? []) {
    const listingId = row.listing_id as string;
    const baseTime = row.sent_to_signature_at ?? row.updated_at;
    const hours = (now - new Date(baseTime as string).getTime()) / 3_600_000;
    const current = byListing.get(listingId);
    if (!current) {
      byListing.set(listingId, { hours, count: 1 });
    } else {
      byListing.set(listingId, { hours: Math.max(current.hours, hours), count: current.count + 1 });
    }
  }

  const summary = Array.from(byListing.entries()).map(([listing_id, v]) => ({
    listing_id,
    hours_pending: Math.floor(v.hours),
    pending_count: v.count,
  }));

  return NextResponse.json({ summary });
}

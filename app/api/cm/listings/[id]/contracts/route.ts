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

// GET /api/cm/listings/[id]/contracts — contratos (NDA, Anexo FPA/NCND, etc.)
// vinculados a este ativo, para o Painel de Monitoramento de Assinaturas
// (timeline + SLA 48h) na aba Governança.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await svc()
    .from("operation_contracts")
    .select("id, contract_title, status_signature, parties, external_envelope_id, signing_token, sent_to_signature_at, signed_at, created_at, updated_at")
    .eq("vertical", "capital_markets")
    .eq("listing_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}

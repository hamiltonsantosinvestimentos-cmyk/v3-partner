import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export type LoiContract = {
  id: string;
  dealId: string;
  dealCode: string;
  buyerName: string;
  buyerEmail: string;
  statusSignature: "rascunho" | "enviado_assinatura" | "assinado" | string;
  externalEnvelopeId: string | null;
  createdAt: string;
  signedAt: string | null;
};

// GET — lista todas as Cartas de Intenção (operation_contracts vinculadas a
// um deal_room_invite, isto é, o fluxo de intake público de compradores),
// para o painel de acompanhamento ponto a ponto dentro de /propostas.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: contracts, error } = await db
    .from("operation_contracts")
    .select("id, deal_id, status_signature, external_envelope_id, created_at, signed_at, parties, deal_room_invite_id")
    .eq("vertical", "ma")
    .not("deal_room_invite_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contracts || contracts.length === 0) return NextResponse.json({ contracts: [] });

  const dealIds = [...new Set(contracts.map(c => c.deal_id).filter(Boolean))];
  const { data: deals } = await db
    .from("ma_deals")
    .select("id, v3_code, legacy_code")
    .in("id", dealIds as string[]);
  const dealMap = new Map((deals ?? []).map(d => [d.id, d.v3_code ?? d.legacy_code ?? d.id]));

  const result: LoiContract[] = contracts.map(c => {
    const parties = (c.parties as Array<{ role: string; name: string; email: string }> | null) ?? [];
    const comprador = parties.find(p => p.role === "comprador");
    return {
      id: c.id,
      dealId: c.deal_id,
      dealCode: dealMap.get(c.deal_id) ?? c.deal_id,
      buyerName: comprador?.name ?? "—",
      buyerEmail: comprador?.email ?? "—",
      statusSignature: c.status_signature,
      externalEnvelopeId: c.external_envelope_id,
      createdAt: c.created_at,
      signedAt: c.signed_at,
    };
  });

  return NextResponse.json({ contracts: result });
}

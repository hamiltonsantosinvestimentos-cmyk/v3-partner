import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

type InspectionRequest = {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  requested_at: string;
  nda_accepted_at?: string | null;
  ncnd_accepted_at?: string | null;
  proof_of_funds_status: "pendente" | "em_analise" | "aprovado" | "rejeitado";
  proof_of_funds_document_url?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  scheduled_at?: string | null;
  status: string;
};

// PATCH — Gate manual de "Prova de Fundos" (trava de compliance da vistoria).
// Sem motor automatizado de KYC financeiro nesta fase: a aprovacao e humana,
// feita por ADMIN/GESTAO/MESA_OPERACIONAL apos conferir o comprovante anexado.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const { id, requestId } = await params;
  const body = await req.json();
  const action = body.action as "aprovar" | "rejeitar" | "agendar";

  if (!["aprovar", "rejeitar", "agendar"].includes(action))
    return NextResponse.json({ error: "action deve ser aprovar, rejeitar ou agendar" }, { status: 422 });

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, inspection_requests")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  const requests: InspectionRequest[] = Array.isArray(listing.inspection_requests) ? listing.inspection_requests : [];
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx === -1) return NextResponse.json({ error: "Pedido de vistoria não encontrado" }, { status: 404 });

  const current = requests[idx];

  if (action === "agendar") {
    if (current.proof_of_funds_status !== "aprovado")
      return NextResponse.json(
        { error: "Agendamento bloqueado — Prova de Fundos ainda não foi aprovada para este comprador" },
        { status: 409 }
      );
    requests[idx] = { ...current, scheduled_at: body.scheduled_at ?? new Date().toISOString(), status: "agendado" };
  } else {
    requests[idx] = {
      ...current,
      proof_of_funds_status: action === "aprovar" ? "aprovado" : "rejeitado",
      proof_of_funds_document_url: body.proof_of_funds_document_url ?? current.proof_of_funds_document_url ?? null,
      approved_by: caller.userId,
      approved_at: new Date().toISOString(),
      status: action === "aprovar" ? "fundos_aprovados" : "recusado",
    };
  }

  const { error } = await svc()
    .from("cm_asset_listings")
    .update({ inspection_requests: requests })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inspection_requests: requests });
}

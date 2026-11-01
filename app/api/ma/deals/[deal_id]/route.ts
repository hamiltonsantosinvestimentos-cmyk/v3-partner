import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteDeServico, lerDealParaSolicitante } from "@/lib/ma/deal-para-originador";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/ma/deals/[deal_id]: detalhe do deal. Equipe interna recebe o deal inteiro; o partner só se for
// originador (originator_profile_id ou created_by), pelas colunas aprovadas, e a leitura é registrada antes
// de o dado sair. Anônimo: 401. Deal que não é do partner, ou inexistente: 404 genérico.
export async function GET(req: NextRequest, { params }: { params: Promise<{ deal_id: string }> }) {
  const { deal_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const db = clienteDeServico();
  const { data: perfil } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  const role = (perfil as { role?: string } | null)?.role ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

  const r = await lerDealParaSolicitante(deal_id, { id: user.id, role, nome: (perfil as { full_name?: string } | null)?.full_name ?? null, ip }, db);
  if (!r.ok) {
    const msg = r.status === 500 ? "Não foi possível carregar o deal, tente novamente" : "Deal não encontrado";
    return NextResponse.json({ error: msg }, { status: r.status, headers: NO_STORE });
  }
  return NextResponse.json({ deal: r.deal }, { headers: NO_STORE });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteDeServico } from "@/lib/ma/deal-para-originador";
import { ehPapelInternoDeal, ehOriginadorDoDeal } from "@/lib/ma/acesso-deal";

const NO_STORE = { "Cache-Control": "no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Painel de criativos do deal. Política de sigilo (31/10/2026): o navegador não lê nem escreve
// creative_jobs e creative_files direto no banco; tudo passa por aqui, com papel interno ou originador do deal.
async function autorizar(dealId: string | null) {
  if (!dealId || !UUID_RE.test(dealId)) return { erro: NextResponse.json({ error: "dealId inválido" }, { status: 400, headers: NO_STORE }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  const db = clienteDeServico();
  const { data: perfil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (perfil as { role?: string } | null)?.role ?? "";
  if (!ehPapelInternoDeal(role)) {
    const { data: deal } = await db.from("ma_deals").select("id, originator_profile_id, created_by").eq("id", dealId).is("deleted_at", null).maybeSingle();
    if (!deal || !ehOriginadorDoDeal(deal as Record<string, unknown>, user.id)) {
      return { erro: NextResponse.json({ error: "Deal não encontrado" }, { status: 404, headers: NO_STORE }) };
    }
  }
  return { db, user };
}

// GET /api/ma/criativos?dealId=: último job e arquivos do deal.
export async function GET(req: NextRequest) {
  const a = await autorizar(new URL(req.url).searchParams.get("dealId"));
  if ("erro" in a) return a.erro;
  const dealId = new URL(req.url).searchParams.get("dealId")!;
  const [jobs, files] = await Promise.all([
    a.db.from("creative_jobs").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(1),
    a.db.from("creative_files").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
  ]);
  if (jobs.error || files.error) return NextResponse.json({ error: "Não foi possível carregar os criativos" }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ job: jobs.data?.[0] ?? null, files: files.data ?? [] }, { headers: NO_STORE });
}

// POST /api/ma/criativos { dealId, jobId, acao: "cancelar" }: cancela o job em andamento do próprio deal.
export async function POST(req: NextRequest) {
  let body: { dealId?: string; jobId?: string; acao?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido" }, { status: 400, headers: NO_STORE }); }
  const a = await autorizar(body.dealId ?? null);
  if ("erro" in a) return a.erro;
  if (body.acao !== "cancelar" || !body.jobId || !UUID_RE.test(body.jobId)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 422, headers: NO_STORE });
  }
  const { error } = await a.db
    .from("creative_jobs")
    .update({ status: "ERROR", error_message: "Cancelado manualmente" })
    .eq("id", body.jobId)
    .eq("deal_id", body.dealId!);
  if (error) return NextResponse.json({ error: "Não foi possível cancelar" }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// 05/09/2026 (BRIEF NCNDA Mesa M&A): MESA_OPERACIONAL adicionado, mas
// escopado (ver abaixo) — só enxerga as verticais em que de fato atua como
// analista (ver MESA_OPERACIONAL_VERTICALS), nunca a lista completa de
// Crédito/Parceria/Institucional que ADMIN/GESTAO vêem. Aprovar, revisar
// minuta e enviar para assinatura continuam exclusivos de ADMIN/GESTAO
// (decisão explícita do BRIEF, princípio de menor privilégio).
//
// 05/09/2026, mesmo dia: 'capital_markets' (Bolsa de Ativos) adicionado ao
// lado de 'ma' — pedido direto de João, Taisa Pedroso (MESA_OPERACIONAL)
// atua nas duas mesas como analista, não só M&A. Lista de verticais
// pensada para crescer junto com quem realmente acumula mesas, nunca
// hardcoded para uma pessoa específica.
const MESA_OPERACIONAL_VERTICALS = ["ma", "capital_markets"];

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const requestedVertical = url.searchParams.get("vertical");
  // MESA_OPERACIONAL nunca escolhe uma vertical fora do próprio escopo via
  // query string — se pedir uma das suas (ma/capital_markets), filtra só
  // nela; sem pedido ou pedido inválido, mostra as duas juntas, nunca a
  // lista completa que ADMIN/GESTAO vê. Mesmo padrão de "lado travado pelo
  // tipo de âncora, nunca aceito do client" já usado em
  // app/api/cm/qualifications/route.ts.
  const vertical: string | string[] | null =
    caller.role === "MESA_OPERACIONAL"
      ? (requestedVertical && MESA_OPERACIONAL_VERTICALS.includes(requestedVertical) ? requestedVertical : MESA_OPERACIONAL_VERTICALS)
      : requestedVertical;
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q");
  const ticketId = url.searchParams.get("ticket_id");

  let query = svc()
    .from("operation_contracts")
    .select("*")
    .order("created_at", { ascending: false });

  if (Array.isArray(vertical)) query = query.in("vertical", vertical);
  else if (vertical) query = query.eq("vertical", vertical);
  if (status) query = query.eq("status_signature", status);
  if (search) query = query.ilike("contract_title", `%${search}%`);
  if (ticketId) query = query.eq("ticket_id", ticketId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contractIds = (data ?? []).map((c: any) => c.id);

  let approvals: any[] = [];
  let notes: any[] = [];

  if (contractIds.length > 0) {
    const [appRes, notesRes] = await Promise.all([
      svc().from("contract_approvals").select("*").in("contract_id", contractIds).order("created_at", { ascending: true }),
      svc().from("contract_notes").select("*").in("contract_id", contractIds).order("created_at", { ascending: true }),
    ]);
    approvals = appRes.data ?? [];
    notes = notesRes.data ?? [];
  }

  const contracts = (data ?? []).map((c: any) => ({
    ...c,
    approvals: approvals.filter((a: any) => a.contract_id === c.id),
    notes: notes.filter((n: any) => n.contract_id === c.id),
  }));

  return NextResponse.json({ contracts });
}

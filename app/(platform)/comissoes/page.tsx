import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ComissoesPartnerClient } from "@/components/financeiro/comissoes-partner-client";
import { DEMO_COMISSOES } from "@/lib/demo-data-financeiro";

export const dynamic = "force-dynamic";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function ComissoesPage() {
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("v3_demo_session");
    if (!sessionCookie) redirect("/login");

    let session: { id: string; email: string; full_name: string; role: string };
    try { session = JSON.parse(sessionCookie.value); } catch { redirect("/login"); }

    if (!["ADMIN", "PARTNER", "PARTNER_PRO", "FINANCEIRO", "GESTAO"].includes(session.role)) redirect("/unauthorized");

    return (
      <ComissoesPartnerClient
        partnerId={session.id}
        partnerName={session.full_name}
        role={session.role}
        commissions={DEMO_COMISSOES.map(c => ({
          id: c.id,
          code: c.codigo,
          partner_id: c.partnerId,
          operation_type: c.operacaoTipo,
          operation_code: c.operacaoCodigo,
          operation_description: c.operacaoDescricao,
          operation_value: c.valorOperacao,
          commission_percent: c.percentualComissao,
          commission_value: c.valorComissao,
          status: c.status,
          operation_closed_at: c.dataOperacaoFinalizada,
          payment_date: c.dataPagamento ?? null,
          notes: c.observacoes ?? null,
          created_at: c.dataOperacaoFinalizada,
        }))}
      />
    );
  }

  // Production
  const { createClient } = await import("@/lib/supabase/server");
  const { createClient: sc } = await import("@supabase/supabase-js");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !["ADMIN", "PARTNER", "PARTNER_PRO", "FINANCEIRO", "GESTAO"].includes(profile.role)) redirect("/unauthorized");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let query = svc
    .from("commissions")
    .select(`
      id, code, partner_id, operation_type, operation_code, operation_description,
      operation_value, commission_percent, commission_value, status,
      operation_closed_at, payment_date, notes, created_at
    `)
    .order("created_at", { ascending: false });

  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes(profile.role)) {
    query = query.eq("partner_id", user.id);
  }

  const { data: commissions } = await query;

  return (
    <ComissoesPartnerClient
      partnerId={user.id}
      partnerName={profile.full_name ?? ""}
      role={profile.role}
      commissions={(commissions ?? []) as Parameters<typeof ComissoesPartnerClient>[0]["commissions"]}
    />
  );
}

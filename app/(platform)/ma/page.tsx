import { MaClient, type MaDeal } from "@/components/ma/ma-client";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function MAPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialDeals: MaDeal[] = [];
  let userId = "";
  let userName = "";
  let userRole = "PARTNER";

  if (user) {
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: profile } = await svc
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    userId   = profile?.id   ?? user.id ?? "";
    userName = profile?.full_name ?? "";
    userRole = profile?.role ?? "PARTNER";

    const adminRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
    const isAdmin = adminRoles.includes(userRole);

    // Política de sigilo (31/10/2026): o partner recebe só as colunas comerciais mínimas dos deals que
    // originou (originator_profile_id ou created_by). Notas, comentários, probabilidade e o responsável da
    // equipe ficam de fora; assigned_to sem originação não dá acesso. A equipe interna segue com a tela completa.
    const colunasInternas = "id, code, title, target_company, sector, deal_value, ebitda_multiple, stage, probability_percent, created_at, notes, comments, asset_data, assigned_to, created_by, partner:profiles!assigned_to(id, full_name)";
    const colunasPartner = "id, code, title, target_company, sector, deal_value, ebitda_multiple, stage, created_at";
    let query = svc
      .from("ma_deals")
      .select(isAdmin ? colunasInternas : colunasPartner)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.is("deleted_at", null).or(`originator_profile_id.eq.${user.id},created_by.eq.${user.id}`);
    }

    const { data: dealsData, error } = await query;
    if (error) {
      console.error("[ma/page] query error:", error.message);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialDeals = (dealsData ?? []).map((d: any): MaDeal => ({
      id:                  d.id,
      code:                d.code,
      target_company:      d.target_company ?? d.title ?? "Sem nome",
      sector:              d.sector ?? null,
      deal_value:          d.deal_value ?? null,
      ebitda_multiple:     d.ebitda_multiple ?? null,
      stage:               d.stage ?? "PROSPECTING",
      probability_percent: d.probability_percent ?? 0,
      created_at:          d.created_at ?? "",
      title:               d.title ?? null,
      notes:               d.notes ?? null,
      comments:            Array.isArray(d.comments) ? d.comments : [],
      asset_data:          (d.asset_data ?? {}) as Record<string, unknown>,
      responsible: (() => {
        const p = d.partner;
        if (Array.isArray(p)) return (p[0] as { full_name?: string })?.full_name ?? null;
        return (p as { full_name?: string } | null)?.full_name ?? null;
      })(),
    }));
  }

  return (
    <MaClient
      deals={initialDeals}
      userId={userId}
      userName={userName}
      userRole={userRole}
    />
  );
}

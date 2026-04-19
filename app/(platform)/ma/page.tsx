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

  if (user) {
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: profile } = await svc
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    userId   = profile?.id   ?? user.id ?? "";
    userName = profile?.full_name ?? "";

    const adminRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
    const isAdmin = adminRoles.includes(profile?.role ?? "");

    let query = svc
      .from("ma_deals")
      .select("id, code, title, target_company, sector, deal_value, ebitda_multiple, stage, probability_percent, created_at, notes, comments, asset_data, assigned_to, created_by, partner:profiles!assigned_to(id, full_name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
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
    />
  );
}

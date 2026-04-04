import { MaClient, type MaDeal } from "@/components/ma/ma-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { DEMO_DEALS } from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SELECT_FIELDS = `
  id, code, title, target_company, sector,
  deal_value, ebitda_multiple, stage,
  probability_percent, created_at, notes, comments,
  partner:profiles!ma_deals_assigned_to_fkey(id, full_name)
`;

export default async function MAPage() {
  let deals: MaDeal[] = [];
  let userId = "";
  let userName = "";

  if (IS_DEMO) {
    deals = DEMO_DEALS as MaDeal[];
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const svc = serviceClient();

    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? "";

    if (!userId) return <MaClient deals={[]} userId="" userName="" />;

    const { data: profile } = await svc
      .from("profiles").select("role, full_name").eq("id", userId).single();
    const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile?.role ?? "");
    const partnerFullName: string = profile?.full_name ?? "";
    userName = partnerFullName;

    let rawData: Record<string, unknown>[] = [];

    if (isAdmin) {
      const { data } = await svc
        .from("ma_deals").select(SELECT_FIELDS)
        .order("created_at", { ascending: false });
      rawData = (data ?? []) as Record<string, unknown>[];
    } else {
      const { data: d1 } = await svc
        .from("ma_deals").select(SELECT_FIELDS)
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .order("created_at", { ascending: false });
      rawData = (d1 ?? []) as Record<string, unknown>[];

      if (partnerFullName) {
        const { data: d2 } = await svc
          .from("ma_deals").select(SELECT_FIELDS)
          .ilike("notes", `%Partner: ${partnerFullName}%`)
          .order("created_at", { ascending: false });
        if (d2?.length) {
          const seen = new Set(rawData.map((d) => d.id as string));
          for (const d of d2 as Record<string, unknown>[]) {
            if (!seen.has(d.id as string)) rawData.push(d);
          }
        }
      }
    }

    deals = rawData.map((d) => ({
      id: d.id as string,
      code: d.code as string,
      target_company: (d.target_company ?? d.title ?? "Sem nome") as string,
      sector: d.sector as string | null,
      deal_value: d.deal_value as number | null,
      ebitda_multiple: d.ebitda_multiple as number | null,
      stage: d.stage as string,
      probability_percent: d.probability_percent as number | null,
      created_at: d.created_at as string,
      notes: d.notes as string | null,
      comments: Array.isArray(d.comments) ? d.comments : [],
      responsible: (() => {
        const p = d.partner;
        if (Array.isArray(p)) return (p[0] as { full_name?: string })?.full_name ?? null;
        return (p as { full_name?: string } | null)?.full_name ?? null;
      })(),
    }));
  }

  return <MaClient deals={deals} userId={userId} userName={userName} />;
}

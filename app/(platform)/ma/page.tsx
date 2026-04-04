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
  probability_percent, created_at, notes,
  partner:profiles!ma_deals_assigned_to_fkey(id, full_name)
`;

export default async function MAPage() {
  let deals: MaDeal[] = [];
  let userId = "";
  let pipefyCfg: { token?: string; pipeId?: string; formUrl?: string } | null = null;

  if (IS_DEMO) {
    deals = DEMO_DEALS as MaDeal[];
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const svc = serviceClient();

    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? "";

    if (!userId) return <MaClient deals={[]} userId="" pipefyCfg={null} />;

    const { data: profile } = await svc
      .from("profiles").select("role, full_name").eq("id", userId).single();
    const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile?.role ?? "");
    const partnerFullName: string = profile?.full_name ?? "";

    // ── Lê config do Pipefy para passar ao cliente ────────────────────────────
    try {
      const { data: cfgRow } = await svc
        .from("app_config").select("value").eq("key", "pipefy_ma").single();
      const raw = cfgRow?.value as { token?: string; pipeId?: string; formUrl?: string } | null;
      if (raw?.token && raw?.pipeId) {
        pipefyCfg = raw;

        // Sync server-side antes de buscar os deals
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL ?? "https://v3-partner.vercel.app"}/api/pipefy`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "sync_ma",
                token: raw.token,
                pipeId: raw.pipeId,
                userId,
              }),
            }
          );
        } catch { /* silently skip */ }
      }
    } catch { /* app_config não existe ainda */ }

    // ── Busca deals — usa service client para garantir sem bloqueio de RLS ──
    let rawData: Record<string, unknown>[] = [];

    if (isAdmin) {
      // Admin vê todos os deals
      const { data } = await svc
        .from("ma_deals").select(SELECT_FIELDS)
        .order("created_at", { ascending: false });
      rawData = (data ?? []) as Record<string, unknown>[];
    } else {
      // Query 1: deals atribuídos ao partner ou criados por ele
      const { data: d1 } = await svc
        .from("ma_deals").select(SELECT_FIELDS)
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .order("created_at", { ascending: false });

      rawData = (d1 ?? []) as Record<string, unknown>[];

      // Query 2: deals onde o nome do partner está nas notes
      // (cobre quando o UUID não foi atribuído por diferença de grafia)
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
      responsible: (() => {
        const p = d.partner;
        if (Array.isArray(p)) return (p[0] as { full_name?: string })?.full_name ?? null;
        return (p as { full_name?: string } | null)?.full_name ?? null;
      })(),
    }));
  }

  return <MaClient deals={deals} userId={userId} pipefyCfg={pipefyCfg} />;
}

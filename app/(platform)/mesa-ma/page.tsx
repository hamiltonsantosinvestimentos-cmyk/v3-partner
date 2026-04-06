import { MesaMaClient } from "@/components/mesa-ma/mesa-ma-client";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

// Mapeia o deal_stage ENUM do Supabase para os IDs internos do pipeline
const STAGE_TO_PIPELINE: Record<string, string> = {
  PROSPECTING:   "prospeccao",
  QUALIFICATION: "qualificacao",
  IOI:           "viabilidade",
  DUE_DILIGENCE: "due_diligence",
  PROPOSAL:      "estruturacao",
  NEGOTIATION:   "negociacao",
  CLOSING:       "aprovacao",
  CLOSED_WON:    "aprovacao",
  CLOSED_LOST:   "aprovacao",
};

export default async function MesaMaPage() {
  // ── DEMO MODE ──────────────────────────────────────────────────────────────
  if (IS_DEMO) {
    const cookieStore = await cookies();
    let userRole = "GESTAO";
    try {
      const session = cookieStore.get("v3_demo_session")?.value;
      if (session) userRole = JSON.parse(session).role ?? "GESTAO";
    } catch {}
    return (
      <MesaMaClient
        userRole={userRole}
        initialDeals={[]}
        userId="demo-admin-001"
        userName="Admin V3"
      />
    );
  }

  // ── PRODUÇÃO ───────────────────────────────────────────────────────────────
  const { createClient } = await import("@/lib/supabase/server");
  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const userRole = profile?.role ?? "GESTAO";

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: deals } = await svc
    .from("ma_deals")
    .select(`
      id, code, title, target_company, sector,
      deal_value, ebitda_multiple, stage,
      probability_percent, created_at, notes, comments,
      assigned_to,
      partner:profiles!ma_deals_assigned_to_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  const initialDeals = (deals ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    company: d.target_company ?? d.title ?? "Sem nome",
    sector: d.sector ?? "",
    value: d.deal_value ?? 0,
    stage: STAGE_TO_PIPELINE[d.stage] ?? "prospeccao",
    responsible: Array.isArray(d.partner)
      ? (d.partner[0]?.full_name ?? "—")
      : ((d.partner as { full_name?: string } | null)?.full_name ?? "—"),
    probability: d.probability_percent ?? 0,
    createdAt: d.created_at?.split("T")[0] ?? "",
    notes: d.notes ?? "",
    comments: Array.isArray(d.comments) ? d.comments : [],
  }));

  return (
    <MesaMaClient
      userRole={userRole}
      initialDeals={initialDeals}
      userId={user?.id ?? ""}
      userName={(profile as { full_name?: string } | null)?.full_name ?? "Mesa"}
    />
  );
}

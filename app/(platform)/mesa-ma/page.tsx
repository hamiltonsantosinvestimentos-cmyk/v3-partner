import { MesaMaClient } from "@/components/mesa-ma/mesa-ma-client";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
  const supabase = await createClient();

  // Usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const userRole = profile?.role ?? "GESTAO";

  // Busca todos os deals com service client (sem RLS, sem cache)
  const svc = serviceClient();
  const { data: deals } = await svc
    .from("ma_deals")
    .select(`
      id, code, title, target_company, sector,
      deal_value, ebitda_multiple, stage,
      probability_percent, created_at, notes,
      assigned_to,
      partner:profiles!ma_deals_assigned_to_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  // Converte para o formato MaCard usado pelo cliente
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
  }));

  return <MesaMaClient userRole={userRole} initialDeals={initialDeals} userId={user?.id ?? ""} userName={profile?.full_name ?? "Mesa"} />;
}

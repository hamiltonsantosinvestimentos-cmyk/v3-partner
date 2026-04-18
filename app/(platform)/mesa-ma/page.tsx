import { MesaMaClient } from "@/components/mesa-ma/mesa-ma-client";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function MesaMaPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: profile } = await svc
    .from("profiles")
    .select("role, full_name")
    .eq("id", user?.id ?? "")
    .single();

  const userRole = (profile as { role?: string } | null)?.role ?? "GESTAO";
  const userName = (profile as { full_name?: string } | null)?.full_name ?? "Mesa";

  // Carrega deals server-side para garantir que aparecem imediatamente ao abrir a página
  const { data: dealsData, error: dealsError } = await svc
    .from("ma_deals")
    .select("id, code, title, target_company, sector, deal_value, ebitda_multiple, stage, probability_percent, expected_close_date, created_at, notes, comments, assigned_to, created_by, asset_data, location, partner:profiles!assigned_to(id, full_name)")
    .order("created_at", { ascending: false });

  if (dealsError) console.error("[mesa-ma/page] query error:", dealsError.message);

  const STAGE_MAP: Record<string, string> = {
    PROSPECTING: "prospeccao", QUALIFICATION: "qualificacao",
    IOI: "viabilidade", DUE_DILIGENCE: "due_diligence",
    PROPOSAL: "estruturacao", NEGOTIATION: "negociacao",
    CLOSING: "aprovacao", CLOSED_WON: "aprovacao", CLOSED_LOST: "aprovacao",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialDeals = (dealsData ?? []).map((d: any) => {
    const assetData = (d.asset_data ?? {}) as Record<string, unknown>;
    const partner = d.partner;
    const responsible = Array.isArray(partner)
      ? (partner[0] as { full_name?: string })?.full_name ?? userName
      : (partner as { full_name?: string } | null)?.full_name ?? userName;
    return {
      id:               d.id as string,
      code:             d.code as string,
      company:          (d.target_company ?? d.title ?? "Sem nome") as string,
      sector:           (d.sector ?? "") as string,
      value:            (d.deal_value ?? 0) as number,
      stage:            STAGE_MAP[d.stage as string] ?? d.stage ?? "prospeccao",
      dbStage:          d.stage as string,
      responsible,
      assigned_to_id:   d.assigned_to as string | undefined,
      probability:      (d.probability_percent ?? 0) as number,
      createdAt:        ((d.created_at as string) ?? "").split("T")[0],
      notes:            (d.notes ?? "") as string,
      comments:         Array.isArray(d.comments) ? d.comments : [],
      asset_data:       assetData,
      location:         (d.location ?? "") as string,
      tipo_participante: assetData?.tipo_participante as string | undefined,
    };
  });

  return (
    <MesaMaClient
      userRole={userRole}
      initialDeals={initialDeals}
      userId={user?.id ?? ""}
      userName={userName}
    />
  );
}

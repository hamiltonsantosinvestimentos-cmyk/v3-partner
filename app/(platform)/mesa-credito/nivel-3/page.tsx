import { CreditDeskClient } from "@/components/mesa-credito/credit-desk-client";
import { DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const IS_DEMO = false;

export default async function Nivel3Page() {
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = cookieStore.get("v3_demo_session")?.value;
    let currentUser = { id: "demo-gestao-001", full_name: "Maria Gestão Costa", role: "GESTAO" };
    if (session) { try { currentUser = JSON.parse(session); } catch {} }
    const proposals = DEMO_CREDIT_PROPOSALS.filter((p) => p.current_level === "NIVEL_3").map((p, i) => ({
      ...p, stage: ["ANALISE", "APROVACAO"][i % 2],
      client_type: "PJ", partner_id: "demo-partner-001", partner_name: "João Partner Silva",
      docs_uploaded: 7, docs_required: 10,
    }));
    return <CreditDeskClient proposals={proposals as Parameters<typeof CreditDeskClient>[0]["proposals"]} level="NIVEL_3" currentUser={currentUser} />;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user?.id ?? "").single();
  const currentUser = { id: profile?.id ?? user?.id ?? "", full_name: profile?.full_name ?? "Partner", role: profile?.role ?? "PARTNER" };
  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(currentUser.role);

  let query = supabase.from("credit_desk_proposals").select("*").eq("current_level", "NIVEL_3").order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("partner_id", currentUser.id);

  const { data } = await query;
  return <CreditDeskClient proposals={(data ?? []) as Parameters<typeof CreditDeskClient>[0]["proposals"]} level="NIVEL_3" currentUser={currentUser} />;
}

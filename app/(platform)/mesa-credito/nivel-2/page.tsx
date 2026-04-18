import { CreditDeskClient } from "@/components/mesa-credito/credit-desk-client";
import { DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const IS_DEMO = false;

export default async function Nivel2Page() {
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = cookieStore.get("v3_demo_session")?.value;
    let currentUser = { id: "demo-partner-001", full_name: "João Partner Silva", role: "PARTNER" };
    if (session) { try { currentUser = JSON.parse(session); } catch {} }
    const proposals = DEMO_CREDIT_PROPOSALS.filter((p) => p.current_level === "NIVEL_2").map((p, i) => ({
      ...p, stage: ["RECEBIDO", "ANALISE", "APROVACAO"][i % 3],
      client_type: "PJ", partner_id: "demo-partner-001", partner_name: "João Partner Silva",
      docs_uploaded: i + 3, docs_required: 8,
    }));
    return <CreditDeskClient proposals={proposals as Parameters<typeof CreditDeskClient>[0]["proposals"]} level="NIVEL_2" currentUser={currentUser} />;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user?.id ?? "").single();
  const currentUser = { id: profile?.id ?? user?.id ?? "", full_name: profile?.full_name ?? "Partner", role: profile?.role ?? "PARTNER" };
  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(currentUser.role);

  let query = supabase.from("credit_desk_proposals").select("*").eq("current_level", "NIVEL_2").order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("partner_id", currentUser.id);

  const { data } = await query;
  return <CreditDeskClient proposals={(data ?? []) as Parameters<typeof CreditDeskClient>[0]["proposals"]} level="NIVEL_2" currentUser={currentUser} />;
}

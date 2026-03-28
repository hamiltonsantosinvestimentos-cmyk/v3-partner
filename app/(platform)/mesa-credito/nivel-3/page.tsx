import { CreditDeskClient } from "@/components/mesa-credito/credit-desk-client";
import { DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function Nivel3Page() {
  let currentUser = { id: "demo-gestao-001", full_name: "Maria Gestão Costa", role: "GESTAO" };

  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  if (session) {
    try { currentUser = JSON.parse(session); } catch {}
  }

  if (IS_DEMO) {
    const proposals = DEMO_CREDIT_PROPOSALS.filter((p) => p.current_level === "NIVEL_3").map((p, i) => ({
      ...p,
      stage: ["ANALISE", "APROVACAO"][i % 2],
      client_type: "PJ",
      partner_id: "demo-partner-001",
      partner_name: "João Partner Silva",
      docs_uploaded: 7,
      docs_required: 10,
    }));
    return (
      <CreditDeskClient
        proposals={proposals as Parameters<typeof CreditDeskClient>[0]["proposals"]}
        level="NIVEL_3"
        currentUser={currentUser}
      />
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_desk_proposals").select("*").eq("current_level", "NIVEL_3")
    .order("created_at", { ascending: false });

  return (
    <CreditDeskClient
      proposals={(data ?? []) as Parameters<typeof CreditDeskClient>[0]["proposals"]}
      level="NIVEL_3"
      currentUser={currentUser}
    />
  );
}

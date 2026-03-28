import { CreditDeskClient } from "@/components/mesa-credito/credit-desk-client";
import { DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function Nivel2Page() {
  let currentUser = { id: "demo-partner-001", full_name: "João Partner Silva", role: "PARTNER" };

  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  if (session) {
    try { currentUser = JSON.parse(session); } catch {}
  }

  if (IS_DEMO) {
    const proposals = DEMO_CREDIT_PROPOSALS.filter((p) => p.current_level === "NIVEL_2").map((p, i) => ({
      ...p,
      stage: ["RECEBIDO", "ANALISE", "APROVACAO"][i % 3],
      client_type: "PJ",
      partner_id: "demo-partner-001",
      partner_name: "João Partner Silva",
      docs_uploaded: i + 3,
      docs_required: 8,
    }));
    return (
      <CreditDeskClient
        proposals={proposals as Parameters<typeof CreditDeskClient>[0]["proposals"]}
        level="NIVEL_2"
        currentUser={currentUser}
      />
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_desk_proposals").select("*").eq("current_level", "NIVEL_2")
    .order("created_at", { ascending: false });

  return (
    <CreditDeskClient
      proposals={(data ?? []) as Parameters<typeof CreditDeskClient>[0]["proposals"]}
      level="NIVEL_2"
      currentUser={currentUser}
    />
  );
}

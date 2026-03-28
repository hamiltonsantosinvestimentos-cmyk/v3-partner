import { MesaOpClient } from "@/components/mesa-operacional/mesa-op-client";
import { DEMO_TICKETS, DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

// Enrich demo proposals with stage info
const DEMO_PROPOSALS_WITH_STAGE = DEMO_CREDIT_PROPOSALS.map((p, i) => ({
  ...p,
  stage: ["RECEBIDO", "TRIAGEM", "ANALISE", "PENDENCIA", "APROVACAO", "FINALIZADO"][i % 6],
  client_type: i % 2 === 0 ? "PF" : "PJ",
  partner_id: "demo-partner-001",
  partner_name: "João Partner Silva",
  docs_uploaded: Math.floor(Math.random() * 5) + 1,
  docs_required: 8,
}));

export default async function MesaOperacionalPage() {
  let currentUser = { id: "demo-mesa-001", full_name: "Carlos Mesa Operacional", role: "MESA_OPERACIONAL" };

  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = cookieStore.get("v3_demo_session")?.value;
    if (session) {
      try { currentUser = JSON.parse(session); } catch {}
    }
    return (
      <MesaOpClient
        tickets={DEMO_TICKETS}
        proposals={DEMO_PROPOSALS_WITH_STAGE as Parameters<typeof MesaOpClient>[0]["proposals"]}
        currentUser={currentUser}
      />
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: ticketsData } = await supabase
    .from("operational_tickets").select("*").order("created_at", { ascending: false });
  const { data: proposalsData } = await supabase
    .from("credit_desk_proposals").select("*").order("created_at", { ascending: false });

  return (
    <MesaOpClient
      tickets={(ticketsData ?? []) as Parameters<typeof MesaOpClient>[0]["tickets"]}
      proposals={(proposalsData ?? []) as Parameters<typeof MesaOpClient>[0]["proposals"]}
      currentUser={currentUser}
    />
  );
}

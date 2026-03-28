import { CreditDeskLevel1Client } from "@/components/mesa-credito/nivel1-client";
import { DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function Nivel1Page() {
  let currentUser = { id: "demo-partner-001", full_name: "João Partner Silva", role: "PARTNER" };

  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  if (session) {
    try { currentUser = JSON.parse(session); } catch {}
  }

  if (IS_DEMO) {
    const proposals = DEMO_CREDIT_PROPOSALS.filter((p) => p.current_level === "NIVEL_1").map((p, i) => ({
      ...p,
      stage: ["RECEBIDO", "TRIAGEM", "ANALISE"][i % 3],
      client_type: i % 2 === 0 ? "PF" : "PJ",
      partner_id: "demo-partner-001",
      partner_name: "João Partner Silva",
      docs_uploaded: i + 2,
      docs_required: 9,
    }));
    return (
      <CreditDeskLevel1Client
        proposals={proposals as Parameters<typeof CreditDeskLevel1Client>[0]["proposals"]}
        currentUser={currentUser}
      />
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_desk_proposals").select("*").eq("current_level", "NIVEL_1")
    .order("created_at", { ascending: false });

  return (
    <CreditDeskLevel1Client
      proposals={(data ?? []) as Parameters<typeof CreditDeskLevel1Client>[0]["proposals"]}
      currentUser={currentUser}
    />
  );
}

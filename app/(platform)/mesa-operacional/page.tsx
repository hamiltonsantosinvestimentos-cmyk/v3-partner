import { MesaOpClient } from "@/components/mesa-operacional/mesa-op-client";
import { DEMO_TICKETS, DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const IS_DEMO = false;

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
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = cookieStore.get("v3_demo_session")?.value;
    let demoUser = { id: "demo-mesa-001", full_name: "Carlos Mesa Operacional", role: "MESA_OPERACIONAL" };
    if (session) {
      try { demoUser = JSON.parse(session); } catch {}
    }
    return (
      <MesaOpClient
        tickets={DEMO_TICKETS}
        proposals={DEMO_PROPOSALS_WITH_STAGE as Parameters<typeof MesaOpClient>[0]["proposals"]}
        currentUser={demoUser}
      />
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user?.id ?? "")
    .single();
  const currentUser = {
    id: profile?.id ?? user?.id ?? "",
    full_name: profile?.full_name ?? "Usuário",
    role: profile?.role ?? "MESA_OPERACIONAL",
  };

  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(currentUser.role);

  // Tickets: admin vê todos, partner vê os próprios
  let ticketsQuery = supabase.from("operational_tickets").select(`
    id, code, title, description, category, priority,
    status, due_date, resolution, created_at, assigned_to,
    requester:profiles!operational_tickets_requester_id_fkey(id, full_name),
    assignee:profiles!operational_tickets_assigned_to_fkey(id, full_name)
  `).order("created_at", { ascending: false });
  if (!isAdmin) ticketsQuery = ticketsQuery.eq("requester_id", currentUser.id);
  const { data: ticketsData } = await ticketsQuery;

  // Propostas: admin vê todas, partner vê somente as suas (usa service client p/ bypassar RLS)
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let proposalsQuery = svc.from("credit_desk_proposals").select("*").order("created_at", { ascending: false });
  if (!isAdmin) proposalsQuery = proposalsQuery.eq("partner_id", currentUser.id);
  const { data: proposalsData } = await proposalsQuery;

  const proposals = (proposalsData ?? []).map((p: any) => ({
    ...p,
    docs_uploaded: Array.isArray(p.documents) ? p.documents.length : 0,
    docs_required: 8,
    mesa_comments_count: Array.isArray(p.mesa_comments) ? p.mesa_comments.length : 0,
  }));

  return (
    <MesaOpClient
      tickets={(ticketsData ?? []) as Parameters<typeof MesaOpClient>[0]["tickets"]}
      proposals={proposals as Parameters<typeof MesaOpClient>[0]["proposals"]}
      currentUser={currentUser}
    />
  );
}

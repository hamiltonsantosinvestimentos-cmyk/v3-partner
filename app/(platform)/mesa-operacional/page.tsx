import { MesaOpClient } from "@/components/mesa-operacional/mesa-op-client";
import { semAnaliseDoSite } from "@/lib/analise-site";
import { DEMO_TICKETS, DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolverAcessoTickets } from "@/lib/mesa-operacional/acesso";
import { createClient as sc } from "@supabase/supabase-js";
import { contarDocsChecklist, montarMapaPortfolio, type LinhaPortfolioDocs } from "@/lib/mesa-operacional/contador-docs";

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
  // Política de sigilo (BRIEF 01/11/2026): sem usuário ou sem perfil não existe papel padrão. A leitura abaixo usa a
  // chave de serviço (a RLS não segura mais), então a decisão de acesso é a função pura, que nega por padrão.
  const acesso = resolverAcessoTickets(user, profile);
  if (acesso.tipo === "negado") redirect("/login");

  const currentUser = {
    id: acesso.id,
    full_name: profile?.full_name ?? "Usuário",
    role: String(profile?.role ?? ""),
  };

  const isAdmin = acesso.tipo === "equipe";
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Tickets: equipe vê todos; os demais veem os tickets em que são solicitante ou responsável (igual ao GET /api/tickets)
  let ticketsQuery = svc.from("operational_tickets").select(`
    id, code, title, description, category, priority,
    status, due_date, resolution, created_at, assigned_to,
    pending_reason, pending_responsible, pending_at,
    pending_resolved_at, pending_resolved_by, reminder_sent_at,
    requester:profiles!operational_tickets_requester_id_fkey(id, full_name),
    assignee:profiles!operational_tickets_assigned_to_fkey(id, full_name)
  `).order("created_at", { ascending: false });
  if (!isAdmin) ticketsQuery = ticketsQuery.or(`requester_id.eq.${acesso.id},assigned_to.eq.${acesso.id}`);
  const { data: ticketsData } = await ticketsQuery;

  // Propostas: equipe vê todas, partner vê somente as suas (usa service client p/ bypassar RLS)
  let proposalsQuery = svc
    .from("credit_desk_proposals")
    .select("*, partner:profiles!partner_id(id, full_name)")
    .order("created_at", { ascending: false });
  if (!isAdmin) proposalsQuery = proposalsQuery.eq("partner_id", currentUser.id);
  const { data: proposalsData } = await proposalsQuery;

  // Checklist do portfólio para o contador "X/Y enviados" do card (mesma consulta e regra da aba Documentos do modal).
  // Erro: segue com mapa vazio e cai nas listas fixas, como o modal quando o fetch falha. Só os números vão ao navegador.
  const { data: portfolioData } = await svc
    .from("portfolio_linhas")
    .select("nome, documentos_pf, documentos_pj")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  const mapaPortfolio = montarMapaPortfolio(portfolioData as LinhaPortfolioDocs[] | null);

  // Propostas técnicas de análise comprada no site não são crédito (lib/analise-site.ts).
  const proposals = semAnaliseDoSite(proposalsData as { metadata?: unknown }[] | null).map((p: any) => {
    const docs = contarDocsChecklist(p, mapaPortfolio);
    return {
    ...p,
    // Normaliza nome do campo CPF/CNPJ (coluna real no BD é client_cpf_cnpj)
    cpf_cnpj: p.client_cpf_cnpj ?? p.cpf_cnpj,
    // Resolve nome do partner via JOIN
    partner_name: (p.partner as any)?.full_name ?? p.partner_name,
    docs_uploaded: docs.enviados,
    docs_required: docs.total,
    mesa_comments_count: Array.isArray(p.mesa_comments) ? p.mesa_comments.length : 0,
    };
  });

  return (
    <MesaOpClient
      tickets={(ticketsData ?? []) as unknown as Parameters<typeof MesaOpClient>[0]["tickets"]}
      proposals={proposals as Parameters<typeof MesaOpClient>[0]["proposals"]}
      currentUser={currentUser}
    />
  );
}

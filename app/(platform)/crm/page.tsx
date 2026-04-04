import { CRMClient } from "@/components/crm/crm-client";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function CRMPage() {
  if (IS_DEMO) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const session = cookieStore.get("v3_demo_session")?.value;
    let userRole = "PARTNER", userName = "Partner", userId = "partner-001";
    if (session) {
      try { const s = JSON.parse(session); userRole = s.role ?? userRole; userName = s.full_name ?? userName; userId = s.id ?? userId; } catch {}
    }
    return <CRMClient userRole={userRole} userName={userName} userId={userId} initialLeads={[]} />;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("id, full_name, role").eq("id", user?.id ?? "").single();

  const userRole  = profile?.role ?? "PARTNER";
  const userName  = profile?.full_name ?? "Partner";
  const userId    = profile?.id ?? user?.id ?? "";
  const isAdmin   = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(userRole);

  let query = supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("partner_id", userId);
  const { data: leadsData } = await query;

  // Normaliza campo snake_case → camelCase para o cliente
  const initialLeads = (leadsData ?? []).map((l) => ({
    id:              l.id,
    code:            l.code,
    name:            l.name,
    document:        l.document ?? "",
    personType:      l.person_type as "PF" | "PJ",
    email:           l.email ?? "",
    phone:           l.phone ?? "",
    segment:         l.segment ?? "",
    annualRevenue:   Number(l.annual_revenue ?? 0),
    city:            l.city ?? "",
    state:           l.state ?? "",
    status:          l.status as "prospect" | "qualificado" | "proposta" | "negociacao" | "ganho" | "perdido",
    source:          l.source as "indicacao" | "ativo" | "digital" | "evento" | "parceiro",
    visitDate:       l.visit_date ?? "",
    nextContact:     l.next_contact ?? "",
    notes:           l.notes ?? "",
    convertedTo:     (l.converted_to ?? "") as "",
    convertedAt:     l.converted_at ?? "",
    productInterest: l.product_interest ?? "",
    creditLine:      l.credit_line ?? "",
    partnerId:       l.partner_id ?? "",
    partnerName:     l.partner_name ?? "",
    createdAt:       l.created_at?.split("T")[0] ?? "",
    interactions:    Array.isArray(l.interactions) ? l.interactions : [],
  }));

  return <CRMClient userRole={userRole} userName={userName} userId={userId} initialLeads={initialLeads} />;
}

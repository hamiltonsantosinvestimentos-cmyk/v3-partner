import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — retorna progresso real do onboarding para o partner logado
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const [crmRes, proposalRes] = await Promise.allSettled([
    svc()
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id),
    svc()
      .from("credit_desk_proposals")
      .select("*", { count: "exact", head: true })
      .or(`created_by.eq.${user.id},partner_id.eq.${user.id}`),
  ]);

  const crmLeads = crmRes.status === "fulfilled" ? (crmRes.value.count ?? 0) : 0;
  const proposals = proposalRes.status === "fulfilled" ? (proposalRes.value.count ?? 0) : 0;

  return NextResponse.json({
    hasFullName: !!(profile?.full_name && profile.full_name.trim().length > 0),
    crmLeads,
    proposals,
    role: profile?.role ?? "PARTNER",
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const token = randomUUID().replace(/-/g, "");

  // Partner dono do lead, atribuido no momento da geracao (BRIEF 18/08/2026) -- nunca
  // confiado sem checar, mesmo criterio ja usado no POST publico deste mesmo intake:
  // um id invalido nunca bloqueia a geracao do link, so fica sem atribuicao.
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawPartnerId = typeof body.origin_partner_id === "string" ? body.origin_partner_id : null;
  const rawReferralId = typeof body.origin_referral_id === "string" ? body.origin_referral_id : null;

  let originPartnerId: string | null = null;
  let originReferralId: string | null = null;
  if (rawPartnerId) {
    const { data } = await svc().from("profiles").select("id").eq("id", rawPartnerId).maybeSingle();
    if (data) originPartnerId = data.id;
  } else if (rawReferralId) {
    const { data } = await svc().from("cm_referral_partners").select("id").eq("id", rawReferralId).maybeSingle();
    if (data) originReferralId = data.id;
  }

  const { data: demand, error } = await svc()
    .from("investor_demands")
    .insert({
      nome_contato: "Pendente",
      email: "pendente@pendente.com",
      setores: ["precatorio"],
      ufs: ["RJ"],
      ticket_min: 0,
      ticket_max: 0,
      tipos_operacao: ["compra"],
      origem: "intake_buy",
      status: "pendente",
      intake_token: token,
      created_by: user.id,
      origin_partner_id: originPartnerId,
      origin_referral_id: originReferralId,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  return NextResponse.json({
    token,
    url: `${protocol}://${host}/intake/buy/${token}`,
    demand_id: demand.id,
  }, { status: 201 });
}

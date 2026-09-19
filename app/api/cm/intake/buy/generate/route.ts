import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Pre-qualificacao da originacao (19/09/2026, mesmo mecanismo e mesmo gate de
// app/api/cm/intake/generate/route.ts, aplicado ao lado comprador): distancia
// ate o mandatario da compra + ciencia da cadeia de intermediarios, obrigatorio
// antes do link nascer, "nao_sei"/"nao_tenho" bloqueiam a geracao.
const VALID_DISTANCIA = ["direto", "um_intermediario", "dois_mais", "nao_sei"];
const VALID_CIENCIA = ["sim_todos", "sim_parcial", "nao_tenho"];
const BLOCKING_DISTANCIA = ["nao_sei"];
const BLOCKING_CIENCIA = ["nao_tenho"];

const INTERNAL_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
// CRM (17/09/2026, mesmo BRIEF do fix de /api/cm/intake/generate): partner
// usa o CRM pra converter os proprios leads em Bolsa de Ativos tambem, entao
// esta rota precisa aceitar partner do mesmo jeito, sempre auto-atribuindo.
const PARTNER_ROLES = ["PARTNER", "PARTNER_PRO", "STARTER", "ENTERPRISE"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as string | undefined;
  const isInternal = !!role && INTERNAL_ROLES.includes(role);
  const isPartner = !!role && PARTNER_ROLES.includes(role);
  if (!isInternal && !isPartner)
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const apelido = typeof body.apelido === "string" ? body.apelido.trim() : "";
  const distanciaCedente = typeof body.distancia_cedente === "string" ? body.distancia_cedente : "";
  const cienciaCadeia = typeof body.ciencia_cadeia === "string" ? body.ciencia_cadeia : "";

  // Pre-qualificacao obrigatoria (19/09/2026): sem isso o link nunca chega a
  // ser gerado. Nao valida no client sozinho -- o gate real e aqui.
  // Correcao no mesmo dia: NUNCA exigir o nome real do mandatario aqui --
  // quebra o duplo-cego, a identidade so pode ser revelada apos reuniao +
  // NCNDA. Apelido da demanda substitui, nome_contato segue "Pendente".
  if (!apelido) {
    return NextResponse.json({ error: "Informe o apelido da demanda antes de gerar o link." }, { status: 422 });
  }
  if (!distanciaCedente || !VALID_DISTANCIA.includes(distanciaCedente)) {
    return NextResponse.json({ error: "Informe a distância até o mandatário da compra." }, { status: 422 });
  }
  if (!cienciaCadeia || !VALID_CIENCIA.includes(cienciaCadeia)) {
    return NextResponse.json({ error: "Informe a ciência da cadeia de intermediários envolvidos." }, { status: 422 });
  }
  if (BLOCKING_DISTANCIA.includes(distanciaCedente) || BLOCKING_CIENCIA.includes(cienciaCadeia)) {
    return NextResponse.json({
      error: "Demanda sem qualidade suficiente para avançar ao estudo preliminar. Mapeie a distância até o mandatário da compra e a cadeia de intermediários antes de prosseguir.",
    }, { status: 422 });
  }

  const token = randomUUID().replace(/-/g, "");

  // Partner dono do lead, atribuido no momento da geracao (BRIEF 18/08/2026) -- nunca
  // confiado sem checar, mesmo criterio ja usado no POST publico deste mesmo intake:
  // um id invalido nunca bloqueia a geracao do link, so fica sem atribuicao. Partner
  // so cria link atribuido a SI MESMO -- nunca aceito do body (17/09/2026).
  const rawPartnerId = typeof body.origin_partner_id === "string" ? body.origin_partner_id : null;
  const rawReferralId = typeof body.origin_referral_id === "string" ? body.origin_referral_id : null;

  let originPartnerId: string | null = null;
  let originReferralId: string | null = null;
  if (isPartner) {
    originPartnerId = user.id;
  } else if (rawPartnerId) {
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
      apelido,
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
      pre_qualificacao: {
        distancia_cedente: distanciaCedente,
        ciencia_cadeia: cienciaCadeia,
        qualified_by: user.id,
        qualified_at: new Date().toISOString(),
      },
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

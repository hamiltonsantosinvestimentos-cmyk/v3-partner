import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Pre-qualificacao da originacao (19/09/2026, pedido de Joao): antes de
// existir link nenhum, quem origina o ativo declara a distancia real ate o
// cedente/mandatario e a ciencia da cadeia de intermediarios envolvidos.
// "nao_sei"/"nao_tenho" bloqueiam a geracao do link -- nao e so um registro
// informativo, e um gate de qualidade real.
// Mesma lista de ASSET_TYPES do components/cm/intake-wizard.tsx (o que o
// parceiro efetivamente confirma no formulario final) -- nao a union
// CmAssetType de lib/cm-checklists.ts (taxonomia diferente, so pra checklist
// de documentos). O valor pre-qualificado aqui vira o prefill do wizard, tem
// que ser sempre um valor que o proprio select do wizard aceite.
const VALID_ASSET_TYPES = ["precatorio", "direito_creditorio", "ipi", "icms", "outros"];
const VALID_DISTANCIA = ["direto", "um_intermediario", "dois_mais", "nao_sei"];
const VALID_CIENCIA = ["sim_todos", "sim_parcial", "nao_tenho"];
const BLOCKING_DISTANCIA = ["nao_sei"];
const BLOCKING_CIENCIA = ["nao_tenho"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const INTERNAL_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
// Botao "Novo Ativo" em /meus-ativos (17/09/2026, BRIEF aprovado por Joao --
// acesso "leve": partner dispara o mesmo link de intake que a Mesa ja usa,
// nunca grava direto em cm_asset_listings). Partner so pode criar um link
// NOVO para si mesmo, nunca reutilizar/gerar link de um listing_id existente
// (esse branch fica restrito a role interna, ver abaixo).
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

  const body = await req.json();
  const { listing_id, originator_profile_id, originator_referral_id, apelido, asset_type, distancia_cedente, ciencia_cadeia } = body as {
    listing_id?: string;
    originator_profile_id?: string;
    originator_referral_id?: string;
    apelido?: string;
    asset_type?: string;
    distancia_cedente?: string;
    ciencia_cadeia?: string;
  };

  if (listing_id) {
    // Reenviar/copiar o link de um ativo ja existente e operacao interna da
    // Mesa (usada no botao "Copiar link de intake" da tabela) -- partner
    // nunca chega aqui, so pelo branch de criacao abaixo.
    if (!isInternal) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

    const { data: existing } = await svc()
      .from("cm_asset_listings")
      .select("id, cm_intake_token")
      .eq("id", listing_id)
      .single();

    if (!existing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

    if (existing.cm_intake_token) {
      const host = req.headers.get("host") ?? "app.v3partners.com.br";
      const protocol = host.includes("localhost") ? "http" : "https";
      return NextResponse.json({
        token: existing.cm_intake_token,
        url: `${protocol}://${host}/intake/cm/${existing.cm_intake_token}`,
        reused: true,
      });
    }

    const token = randomUUID().replace(/-/g, "");
    const { error } = await svc()
      .from("cm_asset_listings")
      .update({ cm_intake_token: token })
      .eq("id", listing_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const host = req.headers.get("host") ?? "app.v3partners.com.br";
    const protocol = host.includes("localhost") ? "http" : "https";
    return NextResponse.json({
      token,
      url: `${protocol}://${host}/intake/cm/${token}`,
      listing_id,
    });
  }

  // Pre-qualificacao obrigatoria (19/09/2026): sem isso o link nunca chega a
  // ser gerado. Nao valida no client sozinho -- o gate real e aqui.
  // Correcao no mesmo dia: NUNCA exigir o nome real do cedente aqui -- quebra
  // o protocolo de duplo-cego da V3, a identidade so pode ser revelada apos
  // reuniao + NCNDA, e quem origina pode nem conhece-la ainda (pode estar 2+
  // intermediarios distante). Apelido do ativo substitui, seller_name segue
  // opcional e vira "Pendente" ate ser de fato revelado.
  if (!apelido?.trim()) {
    return NextResponse.json({ error: "Informe o apelido do ativo antes de gerar o link." }, { status: 422 });
  }
  if (!asset_type || !VALID_ASSET_TYPES.includes(asset_type)) {
    return NextResponse.json({ error: "Selecione o tipo de ativo antes de gerar o link." }, { status: 422 });
  }
  if (!distancia_cedente || !VALID_DISTANCIA.includes(distancia_cedente)) {
    return NextResponse.json({ error: "Informe a distância até o cedente/mandatário." }, { status: 422 });
  }
  if (!ciencia_cadeia || !VALID_CIENCIA.includes(ciencia_cadeia)) {
    return NextResponse.json({ error: "Informe a ciência da cadeia de intermediários envolvidos." }, { status: 422 });
  }
  if (BLOCKING_DISTANCIA.includes(distancia_cedente) || BLOCKING_CIENCIA.includes(ciencia_cadeia)) {
    return NextResponse.json({
      error: "Ativo sem qualidade suficiente para avançar ao estudo preliminar. Mapeie a distância até o cedente e a cadeia de intermediários antes de prosseguir.",
    }, { status: 422 });
  }

  const token = randomUUID().replace(/-/g, "");
  // Fix 17/09/2026: antes disto o link nascia com um numero de serie REAL ja
  // classificado como "precatorio Federal", antes de qualquer classificacao
  // existir de fato -- exatamente o problema relatado por Joao ("numeracao
  // automatica antes mesmo de classificar"). O codigo definitivo (com a serie
  // e esfera certas) so e emitido em /api/cm/intake/[token] POST, quando o
  // formulario é enviado e a classificação passa a existir. Este placeholder
  // é só um valor único e temporário para satisfazer a constraint NOT NULL/
  // UNIQUE de anonymous_id — nunca aparece como referência real ao cedente
  // (a tela de confirmação usa o anonymous_id devolvido pelo POST, não este).
  const placeholderAnonId = `PENDENTE-${randomUUID().slice(0, 8).toUpperCase()}`;
  // P0 (22/09/2026): numero_interno tinha geracao propria via
  // generate_cm_numero_interno() (formato V3-YYYY-MM-BOL-NNN, serie "BOL"
  // nunca registrada em v3_code_series), nunca reconciliada com o codigo
  // real emitido depois em /api/cm/intake/[token]. numero_interno passa a
  // ser sempre o mesmo valor de anonymous_id -- aqui, o mesmo placeholder;
  // o codigo definitivo dos dois so nasce apos a classificacao.
  const numeroInterno = placeholderAnonId;

  // Partner so cria link para SI MESMO como originador -- nunca aceito do
  // body (mesmo padrao de investor-demands/cm listings): impede um partner
  // de gerar um ativo em nome de outro partner.
  const resolvedOriginator = isPartner ? user.id : (originator_profile_id ?? null);
  const resolvedReferral = isPartner ? null : (originator_referral_id ?? null);

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .insert({
      anonymous_id: placeholderAnonId,
      numero_interno: numeroInterno,
      originator_profile_id: resolvedOriginator,
      originator_referral_id: resolvedReferral,
      asset_type,
      seller_name: "Pendente",
      apelido: apelido.trim(),
      valor_face: 0,
      listing_status: "reuniao_validada",
      meeting_validated_at: new Date().toISOString(),
      cm_intake_token: token,
      created_by: user.id,
      pre_qualificacao: {
        distancia_cedente,
        ciencia_cadeia,
        qualified_by: user.id,
        qualified_at: new Date().toISOString(),
      },
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  return NextResponse.json({
    token,
    url: `${protocol}://${host}/intake/cm/${token}`,
    listing_id: listing.id,
    listing,
  }, { status: 201 });
}

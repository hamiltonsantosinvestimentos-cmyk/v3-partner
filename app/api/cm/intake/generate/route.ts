import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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
  const { listing_id, originator_profile_id } = body;

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
  const { data: numeroInterno } = await svc().rpc("generate_cm_numero_interno");

  // Partner so cria link para SI MESMO como originador -- nunca aceito do
  // body (mesmo padrao de investor-demands/cm listings): impede um partner
  // de gerar um ativo em nome de outro partner.
  const resolvedOriginator = isPartner ? user.id : (originator_profile_id ?? null);

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .insert({
      anonymous_id: placeholderAnonId,
      numero_interno: numeroInterno,
      originator_profile_id: resolvedOriginator,
      asset_type: "precatorio",
      seller_name: "Pendente",
      valor_face: 0,
      listing_status: "reuniao_validada",
      meeting_validated_at: new Date().toISOString(),
      cm_intake_token: token,
      created_by: user.id,
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

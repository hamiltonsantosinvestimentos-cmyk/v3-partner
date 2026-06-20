import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, listing_status, intake_locked, intake_data, seller_name, ente_devedor, esfera, tribunal, natureza, numero_processo, valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses, allows_tranching")
    .eq("cm_intake_token", token)
    .single();

  if (error || !listing)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (listing.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  return NextResponse.json({
    listing_id: listing.id,
    anonymous_id: listing.anonymous_id,
    status: listing.listing_status,
    prefill: {
      asset_type: listing.asset_type,
      seller_name: listing.seller_name !== "Pendente" ? listing.seller_name : "",
      ente_devedor: listing.ente_devedor ?? "",
      esfera: listing.esfera ?? "",
      tribunal: listing.tribunal ?? "",
      natureza: listing.natureza ?? "",
      numero_processo: listing.numero_processo ?? "",
      valor_face: listing.valor_face > 0 ? listing.valor_face : "",
      valor_atualizado: listing.valor_atualizado ?? "",
      desagio_pretendido: listing.desagio_pretendido ?? "",
      prazo_estimado_meses: listing.prazo_estimado_meses ?? "",
      allows_tranching: listing.allows_tranching ?? false,
      ...(listing.intake_data as Record<string, unknown> ?? {}),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, intake_locked")
    .eq("cm_intake_token", token)
    .single();

  if (!listing)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (listing.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  const body = await req.json();
  const {
    asset_type, seller_name, seller_cpf_cnpj,
    ente_devedor, esfera, tribunal, natureza, numero_processo,
    valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses,
    allows_tranching, nda_accepted,
    contato_nome, contato_email, contato_telefone,
  } = body;

  if (!seller_name || !valor_face || !asset_type) {
    return NextResponse.json({
      error: "Campos obrigatórios: nome do cedente, tipo de ativo e valor de face",
    }, { status: 422 });
  }

  const { data: anonId } = await svc().rpc("generate_cm_anonymous_id", {
    p_asset_type: asset_type,
    p_esfera: esfera ?? "Federal",
  });

  const { error } = await svc()
    .from("cm_asset_listings")
    .update({
      anonymous_id: anonId,
      asset_type,
      seller_name,
      seller_cpf_cnpj: seller_cpf_cnpj ?? null,
      ente_devedor: ente_devedor ?? null,
      esfera: esfera ?? null,
      tribunal: tribunal ?? null,
      natureza: natureza ?? null,
      numero_processo: numero_processo ?? null,
      valor_face: Number(valor_face),
      valor_atualizado: valor_atualizado ? Number(valor_atualizado) : null,
      desagio_pretendido: desagio_pretendido ? Number(desagio_pretendido) : null,
      prazo_estimado_meses: prazo_estimado_meses ? Number(prazo_estimado_meses) : null,
      allows_tranching: allows_tranching ?? false,
      listing_status: "formulario_preenchido",
      form_submitted_at: new Date().toISOString(),
      intake_locked: true,
      intake_data: {
        contato_nome: contato_nome ?? null,
        contato_email: contato_email ?? null,
        contato_telefone: contato_telefone ?? null,
        nda_accepted: nda_accepted ?? false,
        nda_accepted_at: nda_accepted ? new Date().toISOString() : null,
        submitted_at: new Date().toISOString(),
      },
    })
    .eq("id", listing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    message: "Formulário enviado com sucesso. A equipe V3 Partners entrará em contato.",
  });
}

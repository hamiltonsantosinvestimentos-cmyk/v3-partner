import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function POST(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { template_id, listing_id, bid_id, deal_id, credit_proposal_id, commission_percent, extra_data } = await req.json();

  if (!template_id) return NextResponse.json({ error: "template_id obrigatório" }, { status: 422 });

  const { data: template } = await svc()
    .from("contract_templates")
    .select("*")
    .eq("id", template_id)
    .eq("is_active", true)
    .single();

  if (!template) return NextResponse.json({ error: "Template não encontrado ou inativo" }, { status: 404 });

  const variables: Record<string, any> = {
    data_geracao: new Date().toLocaleDateString("pt-BR"),
    data_geracao_extenso: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    ...(extra_data ?? {}),
  };

  if (listing_id) {
    const { data: listing } = await svc()
      .from("cm_asset_listings")
      .select("*")
      .eq("id", listing_id)
      .single();

    if (listing) {
      Object.assign(variables, {
        nome_cedente: listing.seller_name,
        cpf_cnpj_cedente: listing.seller_cpf_cnpj ?? "[CPF/CNPJ]",
        tipo_ativo: listing.asset_type,
        anonymous_id: listing.anonymous_id,
        ente_devedor: listing.ente_devedor ?? "[Ente Devedor]",
        esfera: listing.esfera ?? "[Esfera]",
        tribunal: listing.tribunal ?? "[Tribunal]",
        natureza: listing.natureza ?? "[Natureza]",
        numero_processo: listing.numero_processo ?? "[Processo]",
        valor_face: listing.valor_face,
        valor_atualizado: listing.valor_atualizado ?? listing.valor_face,
        desagio_pretendido: listing.desagio_pretendido ?? 0,
        prazo_estimado_meses: listing.prazo_estimado_meses ?? "[Prazo]",
      });
    }
  }

  if (bid_id) {
    const { data: bid } = await svc()
      .from("cm_bids")
      .select("*")
      .eq("id", bid_id)
      .single();

    if (bid) {
      Object.assign(variables, {
        valor_oferta: bid.bid_value,
        desagio_oferecido: bid.desagio_oferecido ?? 0,
        tipo_pagamento: bid.payment_type === "a_vista" ? "À Vista" : bid.payment_type === "parcelado" ? "Parcelado" : "Escrow",
        notas_comprador: bid.notes ?? "",
      });
    }
  }

  if (deal_id) {
    const { data: deal } = await svc()
      .from("ma_deals")
      .select("asset_name, deal_value, sector, v3_code")
      .eq("id", deal_id)
      .single();

    if (deal) {
      Object.assign(variables, {
        nome_ativo: deal.asset_name,
        valor_deal: deal.deal_value,
        setor: deal.sector,
        v3_code: deal.v3_code ?? "[V3 Code]",
      });
    }
  }

  if (commission_percent !== undefined) {
    variables.comissao_total = commission_percent;
    variables.comissao_v3 = (commission_percent * 0.5).toFixed(2);
    variables.comissao_partner = (commission_percent * 0.3).toFixed(2);
    variables.comissao_intermediario = (commission_percent * 0.2).toFixed(2);
  }

  const renderedBody = resolveContractVariables(template.body_text_raw, variables);
  const contractTitle = resolveContractVariables(template.template_name, variables);
  const renderedHtml = wrapContractInV3Html(contractTitle, renderedBody);

  const { data: contract, error } = await svc()
    .from("operation_contracts")
    .insert({
      template_id,
      vertical: template.vertical,
      listing_id: listing_id ?? null,
      bid_id: bid_id ?? null,
      deal_id: deal_id ?? null,
      credit_proposal_id: credit_proposal_id ?? null,
      contract_title: contractTitle,
      rendered_html: renderedHtml,
      status_signature: "rascunho",
      commission_percent: commission_percent ?? null,
      parties: variables.nome_cedente ? [
        { role: "cedente", name: variables.nome_cedente, doc: variables.cpf_cnpj_cedente },
        { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
      ] : [],
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    contract,
    preview_html: renderedHtml,
    variables_resolved: Object.keys(variables).length,
  }, { status: 201 });
}

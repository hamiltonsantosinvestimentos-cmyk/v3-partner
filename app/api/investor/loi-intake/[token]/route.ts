import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
import { valorEmReaisPorExtenso } from "@/lib/utils/valor-extenso";
import { sendToClickSign } from "@/lib/clicksign";

export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const V3_SYSTEM_PROFILE_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadContext(token: string) {
  const db = svc();

  const { data: invite } = await db
    .from("deal_room_invites")
    .select("id, deal_room_id, investor_name, investor_email, access_side, status, token_expires_at")
    .eq("token", token)
    .single();

  if (!invite) return { error: "Link inválido", status: 404 } as const;
  if (invite.access_side !== "buyer") return { error: "Link não corresponde a um fluxo de compra", status: 403 } as const;
  if (new Date(invite.token_expires_at) < new Date()) return { error: "Link expirado. Solicite um novo à equipe V3 Partners.", status: 410 } as const;

  const { data: room } = await db
    .from("deal_rooms")
    .select("deal_id")
    .eq("id", invite.deal_room_id)
    .single();

  if (!room) return { error: "Deal Room não encontrado", status: 404 } as const;

  const { data: deal } = await db
    .from("ma_deals")
    .select("id, code, v3_code, deal_value, asset_data")
    .eq("id", room.deal_id)
    .single();

  if (!deal) return { error: "Deal não encontrado", status: 404 } as const;

  const { data: existingContract } = await db
    .from("operation_contracts")
    .select("id, status_signature")
    .eq("deal_room_invite_id", invite.id)
    .maybeSingle();

  return { invite, deal, existingContract } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);

  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { invite, deal, existingContract } = ctx;

  if (existingContract) {
    const signed = existingContract.status_signature === "assinado";
    return NextResponse.json({
      locked: true,
      signed,
      message: signed
        ? "Carta de Intenção já assinada. O acesso ao Deal Room já está liberado."
        : "Carta de Intenção já enviada para assinatura. Aguardando confirmação do ClickSign.",
    }, { status: 409 });
  }

  const assetData = (deal.asset_data as Record<string, unknown>) ?? {};
  const specs = assetData.especificacoes_tecnicas as Record<string, unknown> | undefined;
  const preco = assetData.condicao_comercial_publica as Record<string, number> | undefined;
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";

  if (!preco) {
    return NextResponse.json({ error: "Condição comercial pública não configurada para este deal. Contate a Mesa." }, { status: 422 });
  }

  return NextResponse.json({
    deal_code: dealCode,
    investor_name: invite.investor_name,
    ativo_descricao: `LOTE DE ${specs?.quantidade ?? ""} ${(specs?.tipo as string ?? "ATIVOS").toUpperCase()}`.trim(),
    volume_descricao: `${specs?.tonelagem_bruta_total_t ?? "?"} toneladas, correspondentes a ${specs?.quantidade ?? "?"} ${specs?.tipo ?? "unidades"} de ${specs?.tonelagem_bruta_por_embarcacao_t ?? "?"} toneladas cada, fabricação ${specs?.ano_construcao_embarcacoes ?? "?"}.`,
    condicao_comercial: `R$ ${formatBRL(preco.valor_total_por_kg)}/kg entregue no destino, totalizando R$ ${formatBRL(preco.valor_total)}, sendo R$ ${formatBRL(preco.valor_ativo_por_kg)}/kg referente ao valor do ativo na origem (R$ ${formatBRL(preco.valor_ativo_total)}) e R$ ${formatBRL(preco.valor_logistica_por_kg)}/kg referente ao custo logístico de transporte (R$ ${formatBRL(preco.valor_logistica_total)}).`,
    escopo_logistico: `Transporte da origem (${specs?.local_origem ?? "origem"}) até o destino (${specs?.local_destino ?? "destino"}).`,
    valor_total: `R$ ${formatBRL(preco.valor_total)}`,
    valor_total_extenso: valorEmReaisPorExtenso(preco.valor_total),
    prefill: {
      email: invite.investor_email ?? "",
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);

  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { invite, deal, existingContract } = ctx;

  if (existingContract) {
    return NextResponse.json({ error: "Carta de Intenção já foi enviada para este link.", locked: true }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    nome_interessada, razao_social, cnpj, endereco_completo,
    nome_completo_socio, nacionalidade, profissao, estado_civil, cpf, email,
    local,
  } = body;

  const required = { nome_interessada, razao_social, cnpj, endereco_completo, nome_completo_socio, nacionalidade, profissao, estado_civil, cpf, email, local };
  const missing = Object.entries(required).filter(([, v]) => !v || String(v).trim() === "").map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Campos obrigatórios ausentes: ${missing.join(", ")}` }, { status: 422 });
  }

  if (!isValidCNPJ(cnpj)) {
    return NextResponse.json({ error: "CNPJ inválido, confira o número informado." }, { status: 422 });
  }
  if (!isValidCPF(cpf)) {
    return NextResponse.json({ error: "CPF inválido, confira o número informado." }, { status: 422 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 422 });
  }

  const db = svc();

  const assetData = (deal.asset_data as Record<string, unknown>) ?? {};
  const specs = assetData.especificacoes_tecnicas as Record<string, unknown> | undefined;
  const preco = assetData.condicao_comercial_publica as Record<string, number> | undefined;
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";

  if (!preco) {
    return NextResponse.json({ error: "Condição comercial pública não configurada para este deal. Contate a Mesa." }, { status: 422 });
  }

  const { data: template } = await db
    .from("contract_templates")
    .select("id, body_text_raw")
    .eq("template_name", "Carta de Intencao de Compra (Matching)")
    .eq("is_active", true)
    .single();

  if (!template) return NextResponse.json({ error: "Template da Carta de Intenção não encontrado." }, { status: 500 });

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const variables = {
    local,
    data_extenso: dataExtenso,
    nome_interessada, razao_social, cnpj, endereco_completo,
    nome_completo_socio, nacionalidade, profissao, estado_civil, cpf, email,
    ativo_descricao: `LOTE DE ${specs?.quantidade ?? ""} ${(specs?.tipo as string ?? "ATIVOS").toUpperCase()}`.trim(),
    valor_total: `R$ ${formatBRL(preco.valor_total)}`,
    valor_total_extenso: valorEmReaisPorExtenso(preco.valor_total),
    volume_descricao: `${specs?.tonelagem_bruta_total_t ?? "?"} toneladas, correspondentes a ${specs?.quantidade ?? "?"} ${specs?.tipo ?? "unidades"} de ${specs?.tonelagem_bruta_por_embarcacao_t ?? "?"} toneladas cada, fabricação ${specs?.ano_construcao_embarcacoes ?? "?"}.`,
    condicao_comercial: `R$ ${formatBRL(preco.valor_total_por_kg)}/kg entregue no destino, totalizando R$ ${formatBRL(preco.valor_total)}, sendo R$ ${formatBRL(preco.valor_ativo_por_kg)}/kg referente ao valor do ativo na origem (R$ ${formatBRL(preco.valor_ativo_total)}) e R$ ${formatBRL(preco.valor_logistica_por_kg)}/kg referente ao custo logístico de transporte (R$ ${formatBRL(preco.valor_logistica_total)}).`,
    escopo_logistico: `Transporte da origem (${specs?.local_origem ?? "origem"}) até o destino (${specs?.local_destino ?? "destino"}).`,
  };

  const bodyHtml = resolveContractVariables(template.body_text_raw, variables);
  const contractTitle = `Carta de Intenção de Compra, Deal ${dealCode}`;
  const renderedHtml = wrapContractInV3Html(contractTitle, bodyHtml);

  const signingToken = crypto.randomUUID().replace(/-/g, "");

  const { data: contract, error: insertErr } = await db
    .from("operation_contracts")
    .insert({
      template_id: template.id,
      vertical: "ma",
      contract_title: contractTitle,
      rendered_html: renderedHtml,
      status_signature: "rascunho",
      parties: [
        { role: "comprador", name: nome_completo_socio, doc: cpf, email },
        { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
      ],
      deal_id: deal.id,
      deal_room_invite_id: invite.id,
      signing_token: signingToken,
      created_by: V3_SYSTEM_PROFILE_ID,
    })
    .select("id")
    .single();

  if (insertErr || !contract) {
    return NextResponse.json({ error: insertErr?.message ?? "Erro ao criar contrato" }, { status: 500 });
  }

  // Dispara ClickSign real: o documento é servido via annex-sign?format=html
  // (rendered_html já pronto), e a assinatura real é validada pelo webhook.
  // Chamada direta (não HTTP) porque /api/ma/clicksign-send fica atrás do
  // gate de auth do proxy.ts, e esta rota é pública/server-to-server.
  const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/cm/annex-sign/${signingToken}?format=html`;

  const clicksignRes = await sendToClickSign({
    dealId: dealCode,
    documentType: "loi",
    documentUrl,
    documentLabel: contractTitle,
    signatories: [{ name: nome_completo_socio, email }],
  });

  if (!clicksignRes.ok) {
    // Desfaz a criação do contrato para não deixar um "rascunho" travando
    // este invite: sem isso, o gate (existingContract) bloquearia qualquer
    // nova tentativa mesmo sem nada ter sido de fato enviado ao ClickSign.
    await db.from("operation_contracts").delete().eq("id", contract.id);
    return NextResponse.json({ error: `Falha ao enviar para o ClickSign, tente novamente: ${clicksignRes.error}` }, { status: 502 });
  }

  await db.from("operation_contracts").update({
    status_signature: "enviado_assinatura",
    external_envelope_id: clicksignRes.envelopeId,
  }).eq("id", contract.id);

  return NextResponse.json({
    success: true,
    message: `Carta de Intenção enviada para assinatura digital no email ${email}.`,
  });
}

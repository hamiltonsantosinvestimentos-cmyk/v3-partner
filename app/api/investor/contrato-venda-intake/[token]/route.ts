import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCNPJ } from "@/lib/validators/cpf-cnpj";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
import { sendToClickSign } from "@/lib/clicksign";
import { notifyDealTimeline } from "@/lib/ma-negociacao-notify";

export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const V3_SYSTEM_PROFILE_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";
const TEMPLATE_NAME = "Contrato de Compra e Venda de Ativo Naval";

async function loadContext(token: string) {
  const db = svc();

  const { data: invite } = await db
    .from("deal_room_invites")
    .select("id, deal_room_id, investor_name, investor_email, access_side, token_expires_at")
    .eq("token", token)
    .single();

  if (!invite) return { error: "Link inválido", status: 404 } as const;
  if (invite.access_side !== "seller") return { error: "Link não corresponde ao fluxo de venda", status: 403 } as const;
  if (new Date(invite.token_expires_at) < new Date()) return { error: "Link expirado. Solicite um novo à equipe V3 Partners.", status: 410 } as const;

  const { data: room } = await db.from("deal_rooms").select("deal_id").eq("id", invite.deal_room_id).single();
  if (!room) return { error: "Deal Room não encontrado", status: 404 } as const;

  const { data: deal } = await db.from("ma_deals").select("id, code, v3_code, asset_data").eq("id", room.deal_id).single();
  if (!deal) return { error: "Deal não encontrado", status: 404 } as const;

  const { data: existingContract } = await db
    .from("operation_contracts")
    .select("id, status_signature")
    .eq("deal_room_invite_id", invite.id)
    .eq("template_id", (await db.from("contract_templates").select("id").eq("template_name", TEMPLATE_NAME).single()).data?.id)
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
        ? "Contrato de venda já assinado."
        : "Contrato de venda já enviado para assinatura. Aguardando confirmação do ClickSign.",
    }, { status: 409 });
  }

  const assetData = (deal.asset_data as Record<string, unknown>) ?? {};
  const specs = assetData.especificacoes_tecnicas as Record<string, unknown> | undefined;
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";

  return NextResponse.json({
    deal_code: dealCode,
    ativo_descricao: `LOTE DE ${specs?.quantidade ?? ""} ${(specs?.tipo as string ?? "ATIVOS").toUpperCase()}`.trim(),
    valor_liquido: "R$ 0,72/kg, total R$ 1.497.600,00",
    prefill: { email: invite.investor_email ?? "" },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { invite, deal, existingContract } = ctx;
  if (existingContract) {
    return NextResponse.json({ error: "Contrato de venda já foi enviado para este link.", locked: true }, { status: 409 });
  }

  const fail = async (status: number, error: string) => {
    await notifyDealTimeline({
      dealId: deal.id,
      title: "Contrato de Venda rejeitado no cadastro público",
      message: `Tentativa de envio de ${invite.investor_name} (${invite.investor_email}) rejeitada: ${error}`,
      type: "negociacao_falha",
    });
    return NextResponse.json({ error }, { status });
  };

  const body = await req.json().catch(() => ({}));
  const { razao_social_estaleiro, cnpj_estaleiro, nome_representante, email, local } = body;

  const required = { razao_social_estaleiro, cnpj_estaleiro, nome_representante, email, local };
  const missing = Object.entries(required).filter(([, v]) => !v || String(v).trim() === "").map(([k]) => k);
  if (missing.length > 0) {
    return fail(422, `Campos obrigatórios ausentes: ${missing.join(", ")}`);
  }
  if (!isValidCNPJ(cnpj_estaleiro)) {
    return fail(422, "CNPJ inválido, confira o número informado.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(422, "Email inválido.");
  }

  const db = svc();
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";

  const { data: template } = await db
    .from("contract_templates")
    .select("id, body_text_raw")
    .eq("template_name", TEMPLATE_NAME)
    .eq("is_active", true)
    .single();
  if (!template) return fail(500, "Template do Contrato de Venda não encontrado.");

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const bodyHtml = resolveContractVariables(template.body_text_raw, {
    razao_social_estaleiro, cnpj_estaleiro, nome_representante, local, data_extenso: dataExtenso,
  });
  const contractTitle = `Contrato de Compra e Venda de Ativo Naval, Deal ${dealCode}`;
  // Bug real (12/08/2026, mesmo padrão em 6 rotas de geração de contrato):
  // parties nunca chegava em wrapContractInV3Html, então o PDF enviado ao
  // ClickSign saía sem o bloco visual de assinatura.
  const parties = [
    { role: "vendedor", name: nome_representante, doc: cnpj_estaleiro, email },
    { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
  ];
  const renderedHtml = wrapContractInV3Html(contractTitle, bodyHtml, parties);
  const signingToken = crypto.randomUUID().replace(/-/g, "");

  const { data: contract, error: insertErr } = await db
    .from("operation_contracts")
    .insert({
      template_id: template.id,
      vertical: "ma",
      contract_title: contractTitle,
      rendered_html: renderedHtml,
      status_signature: "rascunho",
      parties,
      deal_id: deal.id,
      deal_room_invite_id: invite.id,
      signing_token: signingToken,
      created_by: V3_SYSTEM_PROFILE_ID,
    })
    .select("id")
    .single();

  if (insertErr || !contract) {
    return fail(500, insertErr?.message ?? "Erro ao criar contrato");
  }

  const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/cm/annex-sign/${signingToken}?format=html`;

  const clicksignRes = await sendToClickSign({
    dealId: dealCode,
    documentType: "contrato_venda",
    documentUrl,
    documentLabel: contractTitle,
    signatories: [{ name: nome_representante, email }],
  });

  if (!clicksignRes.ok) {
    await db.from("operation_contracts").delete().eq("id", contract.id);
    return fail(502, `Falha ao enviar para o ClickSign, tente novamente: ${clicksignRes.error}`);
  }

  await db.from("operation_contracts").update({
    status_signature: "enviado_assinatura",
    external_envelope_id: clicksignRes.envelopeId,
  }).eq("id", contract.id);

  await notifyDealTimeline({
    dealId: deal.id,
    title: "Contrato de Venda enviado para assinatura",
    message: `${nome_representante} (${razao_social_estaleiro}) preencheu o Contrato de Venda, enviado ao ClickSign para ${email}.`,
    type: "negociacao_convite",
  });

  return NextResponse.json({
    success: true,
    message: `Contrato de Venda enviado para assinatura digital no email ${email}.`,
  });
}

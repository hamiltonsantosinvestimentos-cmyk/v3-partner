import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
import { valorEmReaisPorExtenso } from "@/lib/utils/valor-extenso";
import { sendToClickSign } from "@/lib/clicksign";
import { auditHtml, auditText } from "@/lib/brand-guardian-gate";
import { notifyDealTimeline } from "@/lib/ma-negociacao-notify";

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

  const fail = async (status: number, error: string) => {
    await notifyDealTimeline({
      dealId: deal.id,
      title: "Carta de Intenção rejeitada no cadastro público",
      message: `Tentativa de envio de ${invite.investor_name} (${invite.investor_email}) rejeitada: ${error}`,
      type: "negociacao_falha",
    });
    return NextResponse.json({ error }, { status });
  };

  const body = await req.json().catch(() => ({}));
  const {
    nome_interessada, razao_social, cnpj, endereco_completo,
    nome_completo_socio, nacionalidade, profissao, estado_civil, cpf, email,
    local,
  } = body;

  const required = { nome_interessada, razao_social, cnpj, endereco_completo, nome_completo_socio, nacionalidade, profissao, estado_civil, cpf, email, local };
  const missing = Object.entries(required).filter(([, v]) => !v || String(v).trim() === "").map(([k]) => k);
  if (missing.length > 0) {
    return fail(422, `Campos obrigatórios ausentes: ${missing.join(", ")}`);
  }

  if (!isValidCNPJ(cnpj)) {
    return fail(422, "CNPJ inválido, confira o número informado.");
  }
  if (!isValidCPF(cpf)) {
    return fail(422, "CPF inválido, confira o número informado.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(422, "Email inválido.");
  }

  const db = svc();

  const assetData = (deal.asset_data as Record<string, unknown>) ?? {};
  const specs = assetData.especificacoes_tecnicas as Record<string, unknown> | undefined;
  const preco = assetData.condicao_comercial_publica as Record<string, number> | undefined;
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";

  if (!preco) {
    return fail(422, "Condição comercial pública não configurada para este deal. Contate a Mesa.");
  }

  const { data: template } = await db
    .from("contract_templates")
    .select("id, body_text_raw")
    .eq("template_name", "Carta de Intencao de Compra (Matching)")
    .eq("is_active", true)
    .single();

  if (!template) return fail(500, "Template da Carta de Intenção não encontrado.");

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
  // Bug real achado 12/08/2026: parties nunca era passado para
  // wrapContractInV3Html, então o PDF que sobe pro ClickSign (via
  // annex-sign?format=html, que serve este rendered_html sem alteração)
  // saía sem o bloco visual de assinatura (linha + nome + CPF), mesmo com o
  // dado já disponível aqui, alguns milímetros abaixo, para o insert.
  // Hoisted para render e insert usarem o mesmo array.
  const parties = [
    { role: "comprador", name: nome_completo_socio, doc: cpf, email },
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
    return fail(502, `Falha ao enviar para o ClickSign, tente novamente: ${clicksignRes.error}`);
  }

  await db.from("operation_contracts").update({
    status_signature: "enviado_assinatura",
    external_envelope_id: clicksignRes.envelopeId,
  }).eq("id", contract.id);

  // Notifica o mandatário de venda para acompanhamento da operação. Falha
  // aqui não desfaz o envio da Carta de Intenção (já está com o comprador);
  // apenas loga, mesmo padrão do notifyClickSignEnvelope acima.
  await notifyMandatarioVenda({ dealCode, contractTitle, buyerName: nome_completo_socio, buyerCompany: razao_social, buyerEmail: email });

  await notifyDealTimeline({
    dealId: deal.id,
    title: "Carta de Intenção enviada para assinatura",
    message: `${nome_completo_socio} (${razao_social}) preencheu a Carta de Intenção, enviada ao ClickSign para ${email}.`,
    type: "negociacao_convite",
  });

  return NextResponse.json({
    success: true,
    message: `Carta de Intenção enviada para assinatura digital no email ${email}.`,
  });
}

const MANDATARIO_VENDA_EMAIL = "rafa2704@gmail.com";
const MANDATARIO_VENDA_NOME = "Rafael Campos";

async function notifyMandatarioVenda(input: {
  dealCode: string;
  contractTitle: string;
  buyerName: string;
  buyerCompany: string;
  buyerEmail: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Carta de Intenção Enviada, V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="font-family:'DM Sans',Arial,sans-serif; background:#09081A; color:#F5F1E8; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#13223A; border:1px solid #243A66; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px 32px; background:#162744; text-align:center;">
            <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" height="32" />
          </td>
        </tr>
        <tr>
          <td style="background:#162744; padding:24px 32px; border-bottom:1px solid #243A66;">
            <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#C9A84C;">V3 Partners, Mesa M&amp;A</p>
            <h1 style="margin:8px 0 0; font-size:20px; font-weight:700; color:#F5F1E8;">Carta de Intenção Enviada para Assinatura</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px; font-size:14px; color:#9BAFC5; line-height:1.6;">
              Prezado(a) ${MANDATARIO_VENDA_NOME}, a operação abaixo teve a Carta de Intenção de Compra enviada para assinatura digital via ClickSign. Você está recebendo esta notificação como mandatário do lado vendedor.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744; border:1px solid #243A66; border-radius:8px; margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#C9A84C;">Deal</p>
                  <p style="margin:0 0 16px; font-size:16px; font-weight:700; color:#F5F1E8;">${input.dealCode}</p>
                  <p style="margin:0; font-size:10px; color:#9BAFC5; text-transform:uppercase; letter-spacing:.08em;">Documento</p>
                  <p style="margin:4px 0 16px; font-size:13px; font-weight:600; color:#F5F1E8;">${input.contractTitle}</p>
                  <p style="margin:0; font-size:10px; color:#9BAFC5; text-transform:uppercase; letter-spacing:.08em;">Comprador</p>
                  <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F5F1E8;">${input.buyerName}, ${input.buyerCompany}</p>
                  <p style="margin:4px 0 0; font-size:12px; color:#9BAFC5;">${input.buyerEmail}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0; font-size:13px; color:#9BAFC5; line-height:1.6;">
              O acesso ao Deal Room é liberado automaticamente assim que a assinatura digital for confirmada.
            </p>
            <hr style="border:none; border-top:1px solid #243A66; margin:24px 0;" />
            <p style="margin:0; font-size:11px; color:#9BAFC5; line-height:1.5;">
              V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50<br />
              <a href="https://v3partners.com.br" style="color:#C9A84C; text-decoration:none;">v3partners.com.br</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const gate = auditHtml(html);
  if (gate.blocking.length > 0) {
    console.error("[loi-intake notifyMandatarioVenda] Brand Guardian bloqueou:", gate.blocking);
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "V3 Partners Plataforma <noreply@v3partners.com.br>",
      to: MANDATARIO_VENDA_EMAIL,
      subject: auditText(`Carta de Intenção enviada, ${input.dealCode}`).corrected,
      html: gate.corrected,
    });
  } catch (err) {
    console.error("[loi-intake notifyMandatarioVenda] Erro ao enviar email:", err);
  }
}

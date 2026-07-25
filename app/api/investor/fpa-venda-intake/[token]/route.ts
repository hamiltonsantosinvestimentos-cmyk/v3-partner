import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
import { sendToClickSign } from "@/lib/clicksign";

export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const V3_SYSTEM_PROFILE_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";
const TEMPLATE_NAME = "FPA Venda (Acordo de Protecao de Honorarios)";
const DEDUCAO_PERCENT = 6;

interface Participante {
  nome: string;
  cpf_cnpj: string;
  email: string;
  bluepay_pix: string;
  valor_bruto: number;
}

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

  const { data: deal } = await db.from("ma_deals").select("id, code, v3_code").eq("id", room.deal_id).single();
  if (!deal) return { error: "Deal não encontrado", status: 404 } as const;

  const { data: template } = await db.from("contract_templates").select("id").eq("template_name", TEMPLATE_NAME).single();

  const { data: existingContract } = await db
    .from("operation_contracts")
    .select("id, status_signature")
    .eq("deal_room_invite_id", invite.id)
    .eq("template_id", template?.id ?? "")
    .maybeSingle();

  return { invite, deal, existingContract } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { deal, existingContract } = ctx;
  if (existingContract) {
    const signed = existingContract.status_signature === "assinado";
    return NextResponse.json({
      locked: true,
      signed,
      message: signed ? "FPA Venda já assinada." : "FPA Venda já enviada para assinatura. Aguardando confirmação do ClickSign.",
    }, { status: 409 });
  }

  return NextResponse.json({
    deal_code: deal.v3_code ?? deal.code ?? "V3-DEAL",
    deducao_percent: DEDUCAO_PERCENT,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { invite, deal, existingContract } = ctx;
  if (existingContract) {
    return NextResponse.json({ error: "FPA Venda já foi enviada para este link.", locked: true }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const { participantes, local } = body as { participantes: Participante[]; local: string };

  if (!local || String(local).trim() === "") {
    return NextResponse.json({ error: "Campo obrigatório ausente: local" }, { status: 422 });
  }
  if (!Array.isArray(participantes) || participantes.length === 0) {
    return NextResponse.json({ error: "Cadastre ao menos 1 participante." }, { status: 422 });
  }
  for (const p of participantes) {
    const required = { nome: p.nome, cpf_cnpj: p.cpf_cnpj, email: p.email, bluepay_pix: p.bluepay_pix };
    const missing = Object.entries(required).filter(([, v]) => !v || String(v).trim() === "").map(([k]) => k);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Participante "${p.nome || "sem nome"}" com campos ausentes: ${missing.join(", ")}` }, { status: 422 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
      return NextResponse.json({ error: `Email inválido para "${p.nome}".` }, { status: 422 });
    }
    if (!p.valor_bruto || Number(p.valor_bruto) <= 0) {
      return NextResponse.json({ error: `Valor bruto inválido para "${p.nome}".` }, { status: 422 });
    }
  }

  const db = svc();
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";

  const { data: template } = await db
    .from("contract_templates")
    .select("id, body_text_raw")
    .eq("template_name", TEMPLATE_NAME)
    .eq("is_active", true)
    .single();
  if (!template) return NextResponse.json({ error: "Template da FPA Venda não encontrado." }, { status: 500 });

  const listaParticipantes = participantes
    .map(p => {
      const liquido = Number(p.valor_bruto) * (1 - DEDUCAO_PERCENT / 100);
      return `${p.nome}, CPF/CNPJ ${p.cpf_cnpj}, valor bruto R$ ${Number(p.valor_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, valor líquido após dedução de ${DEDUCAO_PERCENT}% R$ ${liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, chave PIX BluePay ${p.bluepay_pix}`;
    })
    .join("; ");

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const bodyHtml = resolveContractVariables(template.body_text_raw, {
    lista_participantes: listaParticipantes, local, data_extenso: dataExtenso,
  });
  const contractTitle = `FPA Venda, Deal ${dealCode}`;
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
      commission_percent: DEDUCAO_PERCENT,
      parties: [
        ...participantes.map(p => ({ role: "participante", name: p.nome, doc: p.cpf_cnpj, email: p.email, bluepay_pix: p.bluepay_pix, valor_bruto: p.valor_bruto })),
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
    return NextResponse.json({ error: insertErr?.message ?? "Erro ao criar documento" }, { status: 500 });
  }

  const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/cm/annex-sign/${signingToken}?format=html`;

  const clicksignRes = await sendToClickSign({
    dealId: dealCode,
    documentType: "fpa_venda",
    documentUrl,
    documentLabel: contractTitle,
    signatories: participantes.map(p => ({ name: p.nome, email: p.email })),
  });

  if (!clicksignRes.ok) {
    await db.from("operation_contracts").delete().eq("id", contract.id);
    return NextResponse.json({ error: `Falha ao enviar para o ClickSign, tente novamente: ${clicksignRes.error}` }, { status: 502 });
  }

  await db.from("operation_contracts").update({
    status_signature: "enviado_assinatura",
    external_envelope_id: clicksignRes.envelopeId,
  }).eq("id", contract.id);

  return NextResponse.json({
    success: true,
    message: `FPA Venda enviada para assinatura digital para ${participantes.length} participante(s).`,
  });
}

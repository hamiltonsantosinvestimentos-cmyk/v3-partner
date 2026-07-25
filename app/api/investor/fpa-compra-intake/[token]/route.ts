import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const V3_SYSTEM_PROFILE_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";

interface Participante {
  nome: string;
  cpf_cnpj: string;
  email: string;
  bluepay_pix: string;
}

async function loadContext(token: string) {
  const db = svc();

  const { data: invite } = await db
    .from("deal_room_invites")
    .select("id, deal_room_id, investor_name, investor_email, access_side, token_expires_at, status")
    .eq("token", token)
    .single();

  if (!invite) return { error: "Link inválido", status: 404 } as const;
  if (invite.access_side !== "intermediario") return { error: "Link não corresponde ao fluxo de compra", status: 403 } as const;
  if (new Date(invite.token_expires_at) < new Date()) return { error: "Link expirado. Solicite um novo à equipe V3 Partners.", status: 410 } as const;

  const { data: room } = await db.from("deal_rooms").select("deal_id").eq("id", invite.deal_room_id).single();
  if (!room) return { error: "Deal Room não encontrado", status: 404 } as const;

  const { data: deal } = await db.from("ma_deals").select("id, code, v3_code").eq("id", room.deal_id).single();
  if (!deal) return { error: "Deal não encontrado", status: 404 } as const;

  // FPA Compra não gera operation_contracts (não é documento assinável, é
  // só cadastro de comissionados), então o "já enviado" é rastreado pelo
  // próprio status do invite.
  const alreadySent = invite.status === "fpa_compra_cadastrada";

  return { invite, deal, alreadySent } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { deal, alreadySent } = ctx;
  if (alreadySent) {
    return NextResponse.json({ locked: true, message: "Cadastro de comissionados já enviado para este link." }, { status: 409 });
  }

  return NextResponse.json({ deal_code: deal.v3_code ?? deal.code ?? "V3-DEAL" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadContext(token);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { invite, deal, alreadySent } = ctx;
  if (alreadySent) {
    return NextResponse.json({ error: "Cadastro já foi enviado para este link.", locked: true }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const { participantes } = body as { participantes: Participante[] };

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
  }

  const db = svc();

  // Registro de cadastro puro (sem assinatura, sem cláusula jurídica) fica
  // em operation_contracts mesmo assim, pra reaproveitar a mesma timeline
  // do painel, mas já nasce "assinado" (não é um documento pra assinar).
  // template_id é NOT NULL na tabela (confirmado ao vivo), por isso usa o
  // template "FPA Compra" mesmo sem fluxo de assinatura associado.
  const dealCode = deal.v3_code ?? deal.code ?? "V3-DEAL";
  const contractTitle = `FPA Compra, Deal ${dealCode}`;

  const { data: template } = await db.from("contract_templates").select("id").eq("template_name", "FPA Compra").single();
  if (!template) return NextResponse.json({ error: "Template FPA Compra não encontrado." }, { status: 500 });

  const { error: insertErr } = await db.from("operation_contracts").insert({
    template_id: template.id,
    vertical: "ma",
    contract_title: contractTitle,
    rendered_html: `<p>Cadastro de comissionados do lado da compra, Deal ${dealCode}.</p>`,
    status_signature: "assinado",
    signed_at: new Date().toISOString(),
    parties: [
      ...participantes.map(p => ({ role: "comissionado_compra", name: p.nome, doc: p.cpf_cnpj, email: p.email, bluepay_pix: p.bluepay_pix })),
      { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
    ],
    deal_id: deal.id,
    deal_room_invite_id: invite.id,
    created_by: V3_SYSTEM_PROFILE_ID,
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await db.from("deal_room_invites").update({ status: "fpa_compra_cadastrada" }).eq("id", invite.id);

  return NextResponse.json({
    success: true,
    message: `Cadastro de ${participantes.length} comissionado(s) registrado com sucesso.`,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";

const PLANO_VALOR: Record<string, number> = { PARTNER: 19700, PARTNER_PRO: 39700 };

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await svc()
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  return { user, profile };
}

// GET — lista todos os partners com dados de assinatura
export async function GET() {
  const { user, profile } = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data: partners, error } = await svc()
    .from("profiles")
    .select("id, full_name, email, role, created_at, is_active, trial_expires_at")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .order("created_at", { ascending: false });

  // Se trial_expires_at não existir ainda, tenta sem a coluna
  let finalPartners = partners;
  if (error) {
    const { data: partnersFallback } = await svc()
      .from("profiles")
      .select("id, full_name, email, role, created_at, is_active")
      .in("role", ["PARTNER", "PARTNER_PRO"])
      .order("created_at", { ascending: false });
    finalPartners = partnersFallback;
  }

  // Notificações pendentes de renovação/upgrade
  const { data: pendingNotifs } = await svc()
    .from("notifications")
    .select("message, type, created_at")
    .in("type", ["RENEWAL_REQUEST", "UPGRADE_REQUEST"])
    .eq("read", false)
    .order("created_at", { ascending: false });

  // Histórico de pagamentos (tabela pode não existir ainda)
  let payments: unknown[] = [];
  try {
    const { data: payData } = await svc()
      .from("financeiro_records")
      .select("*")
      .eq("type", "ASSINATURA_PAGAMENTO")
      .order("created_at", { ascending: false });
    payments = payData ?? [];
  } catch { payments = []; }

  // Última cobrança Cora por partner
  let coraByPartner: Record<string, { id: string; status: string; cora_invoice_id?: string; amount_cents: number; due_date: string; pix_emv?: string; paid_at?: string }> = {};
  try {
    const partnerIds = (finalPartners ?? []).map((p: { id: string }) => p.id);
    if (partnerIds.length > 0) {
      const { data: subs } = await svc()
        .from("partner_subscriptions")
        .select("id, partner_id, status, cora_invoice_id, amount_cents, due_date, pix_emv, paid_at, created_at")
        .in("partner_id", partnerIds)
        .order("created_at", { ascending: false });

      // Pega apenas a mais recente por partner
      for (const sub of (subs ?? [])) {
        const s = sub as { partner_id: string; id: string; status: string; cora_invoice_id?: string; amount_cents: number; due_date: string; pix_emv?: string; paid_at?: string };
        if (!coraByPartner[s.partner_id]) {
          coraByPartner[s.partner_id] = s;
        }
      }
    }
  } catch { coraByPartner = {}; }

  return NextResponse.json({
    partners: finalPartners ?? [],
    pendingNotifs: pendingNotifs ?? [],
    payments,
    coraByPartner,
  });
}

// PATCH — renovar (+30d), upgrade para PRO, suspender, reativar
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const { partnerId, action } = body as { partnerId: string; action: string };

  if (!partnerId || !action) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  if (action === "renovar") {
    const novaExpiracao = new Date();
    novaExpiracao.setDate(novaExpiracao.getDate() + 30);
    const { error } = await svc()
      .from("profiles")
      .update({ trial_expires_at: novaExpiracao.toISOString(), is_active: true })
      .eq("id", partnerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === "upgrade") {
    const { error } = await svc()
      .from("profiles")
      .update({ role: "PARTNER_PRO" })
      .eq("id", partnerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === "suspender") {
    const { error } = await svc()
      .from("profiles")
      .update({ is_active: false })
      .eq("id", partnerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === "reativar") {
    const novaExpiracao = new Date();
    novaExpiracao.setDate(novaExpiracao.getDate() + 30);
    const { error } = await svc()
      .from("profiles")
      .update({ is_active: true, trial_expires_at: novaExpiracao.toISOString() })
      .eq("id", partnerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === "gerar_cobranca_cora") {
    // Gera cobrança Cora para um partner específico
    const { data: p } = await svc()
      .from("profiles")
      .select("id, full_name, email, role, trial_expires_at, created_at, cpf, cnpj")
      .eq("id", partnerId)
      .single();

    if (!p) return NextResponse.json({ error: "Partner não encontrado" }, { status: 404 });

    const pp = p as { id: string; full_name: string; email?: string; role: string; trial_expires_at?: string; created_at: string; cpf?: string; cnpj?: string };
    const documento = pp.cpf ?? pp.cnpj ?? "";
    const valor = PLANO_VALOR[pp.role] ?? 19700;

    // Vencimento = data de expiração do partner (ou +30 dias se já venceu)
    const expiry = pp.trial_expires_at ? new Date(pp.trial_expires_at) : new Date();
    const dueDate = expiry > new Date() ? expiry : new Date(Date.now() + 30 * 86400000);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Verifica se já existe cobrança pendente para este partner
    const { data: existing } = await svc()
      .from("partner_subscriptions")
      .select("id, status")
      .eq("partner_id", partnerId)
      .eq("status", "PENDING")
      .limit(1)
      .maybeSingle();

    if (existing) return NextResponse.json({ error: "Já existe cobrança pendente", existing }, { status: 409 });

    let coraData: { id?: string; pix?: { emv?: string; qr_code?: string }; bank_slip?: { pdf?: { url?: string }; our_number?: string } } = {};
    if (documento) {
      const res = await coraFetch("/v2/invoices", {
        method: "POST",
        body: JSON.stringify({
          code: randomUUID().slice(0, 8).toUpperCase(),
          customer: {
            name: pp.full_name,
            document: {
              identity: documento.replace(/\D/g, ""),
              type: documento.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ",
            },
            ...(pp.email ? { contacts: [{ contact: pp.email, type: "EMAIL" }] } : {}),
          },
          payment_terms: { due_date: dueDateStr, amount: valor },
          payment_options: {
            interest: { type: "MONTHLY_PERCENTAGE", value: 1 },
            fine: { type: "PERCENTAGE", value: 2 },
          },
          services: [{ name: `V3 Partners — Mensalidade ${pp.role === "PARTNER_PRO" ? "Partner PRO" : "Partner"}`, amount: valor }],
          notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
        }),
        idempotencyKey: randomUUID(),
      });
      if (res.ok) coraData = await res.json();
    }

    await svc().from("partner_subscriptions").insert({
      partner_id:      partnerId,
      plano:           pp.role,
      amount_cents:    valor,
      due_date:        dueDateStr,
      cora_invoice_id: coraData.id,
      status:          "PENDING",
      pix_emv:         coraData.pix?.emv,
      pix_qr_code:     coraData.pix?.qr_code,
      boleto_barcode:  coraData.bank_slip?.our_number,
      boleto_pdf:      coraData.bank_slip?.pdf?.url,
    });

    return NextResponse.json({ ok: true, cora_invoice_id: coraData.id });

  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// POST — registrar pagamento manual (salva em financeiro_records + renova acesso +30d)
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const { partnerId, partnerNome, partnerRole, valor, mes, ano, observacoes } = body as {
    partnerId: string;
    partnerNome: string;
    partnerRole: string;
    valor: number;
    mes: number;
    ano: number;
    observacoes?: string;
  };

  if (!partnerId || !valor) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const { error: payErr } = await svc()
    .from("financeiro_records")
    .insert({
      type: "ASSINATURA_PAGAMENTO",
      data: {
        partnerId,
        partnerNome,
        partnerRole,
        valor,
        mes,
        ano,
        observacoes: observacoes ?? "",
        dataPagamento: new Date().toISOString(),
      },
    });

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  // Renova acesso +30 dias a partir de hoje
  const novaExpiracao = new Date();
  novaExpiracao.setDate(novaExpiracao.getDate() + 30);
  await svc()
    .from("profiles")
    .update({ trial_expires_at: novaExpiracao.toISOString(), is_active: true })
    .eq("id", partnerId);

  return NextResponse.json({ ok: true });
}

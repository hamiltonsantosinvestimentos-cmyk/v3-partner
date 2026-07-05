import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";
import { sendWhatsApp, resolvePartnerPhone, planoLabel, buildRenovacaoManualMessage } from "@/lib/whatsapp/subscription-messages";

const PLANO_VALOR: Record<string, number> = {
  STARTER:     29700,   // R$ 297,00
  PARTNER:     49700,   // R$ 497,00
  PARTNER_PRO: 89700,   // R$ 897,00
  ENTERPRISE:  250000,  // R$ 2.500,00
};

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Avisa o partner via WhatsApp quando o admin renova/reativa manualmente o acesso por 30 dias
async function notificarRenovacaoManual(partnerId: string, novaExpiracao: Date) {
  const { data: partner } = await svc().from("profiles").select("full_name, role").eq("id", partnerId).single();
  if (!partner) return;
  const phone = await resolvePartnerPhone(svc(), partnerId);
  if (!phone) return;
  const msg = buildRenovacaoManualMessage({
    nome: partner.full_name ?? "Partner",
    plano: planoLabel(partner.role),
    novaExpiracao: novaExpiracao.toISOString(),
  });
  await sendWhatsApp(phone, msg);
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

// GET — lista todos os partners com dados de assinatura (ou histórico de um partner específico)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Histórico de um partner específico
  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get("partnerId");
  if (partnerId) {
    const [subsRes, manualRes] = await Promise.allSettled([
      svc()
        .from("partner_subscriptions")
        .select("id, partner_id, status, cora_invoice_id, amount_cents, due_date, pix_emv, pix_qr_code, boleto_pdf, paid_at, created_at, plano, zap_d5_sent_at, zap_d3_sent_at, zap_d1_sent_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false }),
      svc()
        .from("financeiro_records")
        .select("id, data, created_at")
        .eq("type", "ASSINATURA_PAGAMENTO")
        .order("created_at", { ascending: false }),
    ]);

    const subs = subsRes.status === "fulfilled" ? (subsRes.value.data ?? []) : [];
    const allManual = manualRes.status === "fulfilled" ? (manualRes.value.data ?? []) : [];
    const manual = allManual.filter((r: { data: { partnerId?: string } }) => r.data?.partnerId === partnerId);

    return NextResponse.json({ subs, manual });
  }

  const { data: partners, error } = await svc()
    .from("profiles")
    .select("id, full_name, email, role, created_at, is_active, trial_expires_at")
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .order("created_at", { ascending: false });

  // Se trial_expires_at não existir ainda, tenta sem a coluna
  let finalPartners = partners;
  if (error) {
    const { data: partnersFallback } = await svc()
      .from("profiles")
      .select("id, full_name, email, role, created_at, is_active, trial_expires_at")
      .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
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
  let coraByPartner: Record<string, { id: string; status: string; cora_invoice_id?: string; amount_cents: number; due_date: string; pix_emv?: string; paid_at?: string; zap_d5_sent_at?: string; zap_d3_sent_at?: string; zap_d1_sent_at?: string }> = {};
  try {
    const partnerIds = (finalPartners ?? []).map((p: { id: string }) => p.id);
    if (partnerIds.length > 0) {
      const { data: subs } = await svc()
        .from("partner_subscriptions")
        .select("id, partner_id, status, cora_invoice_id, amount_cents, due_date, pix_emv, paid_at, created_at, zap_d5_sent_at, zap_d3_sent_at, zap_d1_sent_at")
        .in("partner_id", partnerIds)
        .order("created_at", { ascending: false });

      // Pega apenas a mais recente por partner
      for (const sub of (subs ?? [])) {
        const s = sub as { partner_id: string; id: string; status: string; cora_invoice_id?: string; amount_cents: number; due_date: string; pix_emv?: string; paid_at?: string; zap_d5_sent_at?: string; zap_d3_sent_at?: string; zap_d1_sent_at?: string };
        if (!coraByPartner[s.partner_id]) {
          coraByPartner[s.partner_id] = s;
        }
      }
    }
  } catch { coraByPartner = {}; }

  // Cobranças Cora pagas nos últimos 6 meses (para o gráfico)
  let coraPaidHistory: { amount_cents: number; paid_at: string }[] = [];
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: paidSubs } = await svc()
      .from("partner_subscriptions")
      .select("amount_cents, paid_at, due_date, created_at")
      .eq("status", "PAID")
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("paid_at", { ascending: false });
    coraPaidHistory = (paidSubs ?? []).map((s: { amount_cents: number; paid_at?: string; due_date?: string; created_at: string }) => ({
      amount_cents: s.amount_cents,
      paid_at: s.paid_at ?? s.due_date ?? s.created_at,
    }));
  } catch { coraPaidHistory = []; }

  return NextResponse.json({
    partners: finalPartners ?? [],
    pendingNotifs: pendingNotifs ?? [],
    payments,
    coraByPartner,
    coraPaidHistory,
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
    await notificarRenovacaoManual(partnerId, novaExpiracao);

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
    await notificarRenovacaoManual(partnerId, novaExpiracao);

  } else if (action === "editar") {
    const { full_name, role, valor_cents, trial_expires_at } = body as {
      full_name?: string;
      role?: string;
      valor_cents?: number;
      trial_expires_at?: string;
    };

    const updateProfile: Record<string, unknown> = {};
    if (full_name) updateProfile.full_name = full_name;
    if (role) updateProfile.role = role;
    if (trial_expires_at) updateProfile.trial_expires_at = trial_expires_at;

    if (Object.keys(updateProfile).length > 0) {
      const { error } = await svc().from("profiles").update(updateProfile).eq("id", partnerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Salva o valor contratado
    if (valor_cents && valor_cents > 0) {
      // Busca email do partner para atualizar partner_registrations (linkado por email)
      const { data: profileData } = await svc()
        .from("profiles")
        .select("email, role")
        .eq("id", partnerId)
        .single();

      if (profileData?.email) {
        await svc()
          .from("partner_registrations")
          .update({ cora_amount_cents: valor_cents })
          .eq("email", profileData.email);
      }

      // Atualiza subscription existente OU cria uma nova com o valor correto
      const { data: lastSub } = await svc()
        .from("partner_subscriptions")
        .select("id")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSub) {
        await svc()
          .from("partner_subscriptions")
          .update({ amount_cents: valor_cents })
          .eq("id", lastSub.id);
      } else {
        // Cria registro de subscription para guardar o valor contratado
        const venc = new Date();
        venc.setDate(venc.getDate() + 30);
        await svc().from("partner_subscriptions").insert({
          partner_id:   partnerId,
          plano:        role ?? profileData?.role ?? "PARTNER",
          amount_cents: valor_cents,
          due_date:     venc.toISOString().split("T")[0],
          status:       "MANUAL",
        });
      }
    }

  } else if (action === "gerar_cobranca_cora") {
    // Gera cobrança Cora para um partner específico
    const { data: p } = await svc()
      .from("profiles")
      .select("id, full_name, email, role, trial_expires_at, created_at, cpf, cnpj")
      .eq("id", partnerId)
      .single();

    if (!p) return NextResponse.json({ error: "Partner não encontrado" }, { status: 404 });

    const pp = p as { id: string; full_name: string; email?: string; role: string; trial_expires_at?: string; created_at: string; cpf?: string; cnpj?: string };

    // Busca CPF/CNPJ do cadastro se não estiver no profile
    let documento = (pp.cpf ?? pp.cnpj ?? "").replace(/\D/g, "");
    if (!documento) {
      const { data: reg } = await svc()
        .from("partner_registrations")
        .select("cpf, cnpj, tipo_pessoa")
        .eq("email", pp.email ?? "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reg) {
        const r = reg as { cpf?: string; cnpj?: string; tipo_pessoa?: string };
        documento = ((r.cpf ?? r.cnpj ?? "")).replace(/\D/g, "");
      }
    }

    if (!documento) {
      return NextResponse.json({ error: "CPF/CNPJ não encontrado para este partner. Atualize o cadastro." }, { status: 422 });
    }

    // Preço base do plano atual
    let valor = PLANO_VALOR[pp.role] ?? 29700;

    // Grandfathering: se o partner tem um preço contratado menor no cadastro original, usa ele
    const { data: regOriginal } = await svc()
      .from("partner_registrations")
      .select("cora_amount_cents")
      .eq("email", pp.email ?? "")
      .not("cora_amount_cents", "is", null)
      .order("created_at", { ascending: true }) // registro mais antigo = preço original contratado
      .limit(1)
      .maybeSingle();

    if (regOriginal?.cora_amount_cents && regOriginal.cora_amount_cents < valor) {
      valor = regOriginal.cora_amount_cents; // mantém preço contratado
    }

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

    let coraData: { id?: string; pix?: { emv?: string; qr_code?: string }; payment_options?: { bank_slip?: { digitable?: string; url?: string } } } = {};
    const coraRes = await coraFetch("/v2/invoices", {
      method: "POST",
      body: JSON.stringify({
        code: randomUUID().slice(0, 8).toUpperCase(),
        customer: {
          name: pp.full_name,
          document: {
            identity: documento,
            type: documento.length === 11 ? "CPF" : "CNPJ",
          },
          ...(pp.email ? { contacts: [{ contact: pp.email, type: "EMAIL" }] } : {}),
        },
        payment_terms: { due_date: dueDateStr, amount: valor },
        payment_options: {
          interest: { type: "MONTHLY_PERCENTAGE", value: 1 },
          fine: { type: "PERCENTAGE", value: 2 },
        },
        payment_forms: ["BANK_SLIP", "PIX"],
        services: [{ name: `V3 Partners — Mensalidade ${
          pp.role === "ENTERPRISE" ? "Enterprise"
          : pp.role === "PARTNER_PRO" ? "Partner PRO"
          : pp.role === "STARTER" ? "Starter"
          : "Partner"
        }`, amount: valor }],
        notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
      }),
      idempotencyKey: randomUUID(),
    });

    if (!coraRes.ok) {
      const errData = await coraRes.json() as { message?: string };
      return NextResponse.json({ error: `Erro Cora: ${errData.message ?? coraRes.status}` }, { status: 502 });
    }

    coraData = await coraRes.json() as typeof coraData;

    await svc().from("partner_subscriptions").insert({
      partner_id:      partnerId,
      plano:           pp.role,
      amount_cents:    valor,
      due_date:        dueDateStr,
      cora_invoice_id: coraData.id,
      status:          "PENDING",
      pix_emv:         coraData.pix?.emv,
      pix_qr_code:     coraData.pix?.qr_code,
      boleto_barcode:  coraData.payment_options?.bank_slip?.digitable,
      boleto_pdf:      coraData.payment_options?.bank_slip?.url,
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

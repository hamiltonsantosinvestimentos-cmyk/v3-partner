import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";
import {
  sendWhatsApp,
  resolvePartnerPhone,
  planoLabel,
  buildCobrancaMessage,
  buildLembreteMessage,
  buildAvisoBloqueioMessage,
} from "@/lib/whatsapp/subscription-messages";
import { efetivoVencimento } from "@/lib/partner-vencimento";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Mesmos valores usados pelo admin em "Gerar Cobrança Cora" (financeiro/assinaturas)
const PLANO_VALOR: Record<string, number> = {
  STARTER:     29700,   // R$ 297,00
  PARTNER:     49700,   // R$ 497,00
  PARTNER_PRO: 89700,   // R$ 897,00
  ENTERPRISE:  250000,  // R$ 2.500,00
};

type Partner = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  cpf: string | null;
  cnpj: string | null;
  trial_expires_at: string | null;
  created_at: string;
};

type Subscription = {
  id: string;
  status: string;
  due_date: string;
  amount_cents: number;
  pix_emv: string | null;
  boleto_barcode: string | null;
  boleto_pdf: string | null;
  zap_d5_sent_at: string | null;
  zap_d3_sent_at: string | null;
  zap_d1_sent_at: string | null;
};

// Busca a cobrança vigente do partner para o vencimento atual; gera uma nova na Cora se não existir
async function getOrCreatePendingSubscription(
  db: ReturnType<typeof svc>,
  partner: Partner,
  dueDateStr: string
): Promise<Subscription | null> {
  const { data: existing } = await db
    .from("partner_subscriptions")
    .select("*")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.due_date === dueDateStr && (existing.status === "PENDING" || existing.status === "PAID")) {
    return existing as Subscription;
  }

  // Documento (CPF/CNPJ) — cai no cadastro original se faltar no profile
  let documento = (partner.cpf ?? partner.cnpj ?? "").replace(/\D/g, "");
  if (!documento) {
    const { data: reg } = await db
      .from("partner_registrations")
      .select("cpf, cnpj")
      .eq("email", partner.email ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = reg as { cpf?: string; cnpj?: string } | null;
    documento = (r?.cpf ?? r?.cnpj ?? "").replace(/\D/g, "");
  }
  if (!documento) return null;

  // Preço: padrão do plano, ou o valor "grandfathered" contratado originalmente se menor
  let valor = PLANO_VALOR[partner.role] ?? 29700;
  const { data: regOriginal } = await db
    .from("partner_registrations")
    .select("cora_amount_cents")
    .eq("email", partner.email ?? "")
    .not("cora_amount_cents", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (regOriginal?.cora_amount_cents && regOriginal.cora_amount_cents < valor) {
    valor = regOriginal.cora_amount_cents;
  }

  const coraRes = await coraFetch("/v2/invoices", {
    method: "POST",
    body: JSON.stringify({
      code: randomUUID().slice(0, 8).toUpperCase(),
      customer: {
        name: partner.full_name ?? "Partner",
        document: { identity: documento, type: documento.length === 11 ? "CPF" : "CNPJ" },
        ...(partner.email ? { contacts: [{ contact: partner.email, type: "EMAIL" }] } : {}),
      },
      payment_terms: { due_date: dueDateStr, amount: valor },
      payment_options: {
        interest: { type: "MONTHLY_PERCENTAGE", value: 1 },
        fine: { type: "PERCENTAGE", value: 2 },
      },
      payment_forms: ["BANK_SLIP", "PIX"],
      services: [{ name: `V3 Partners — Mensalidade ${planoLabel(partner.role)}`, amount: valor }],
      notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
    }),
    idempotencyKey: randomUUID(),
  });
  if (!coraRes.ok) return null;

  const coraData = await coraRes.json() as {
    id?: string;
    pix?: { emv?: string; qr_code?: string };
    payment_options?: { bank_slip?: { digitable?: string; url?: string } };
  };

  const { data: created } = await db.from("partner_subscriptions").insert({
    partner_id:      partner.id,
    plano:           partner.role,
    amount_cents:    valor,
    due_date:        dueDateStr,
    cora_invoice_id: coraData.id,
    status:          "PENDING",
    pix_emv:         coraData.pix?.emv,
    pix_qr_code:     coraData.pix?.qr_code,
    boleto_barcode:  coraData.payment_options?.bank_slip?.digitable,
    boleto_pdf:      coraData.payment_options?.bank_slip?.url,
  }).select().single();

  return created as Subscription | null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();

  // ── 1. Notificação in-app para admins (rate limit: 1 por 12h) ──────────────
  const { data: recentRuns } = await svc()
    .from("notifications")
    .select("created_at")
    .eq("type", "ASSINATURA_VENCENDO")
    .order("created_at", { ascending: false })
    .limit(1);

  const recentRun = recentRuns?.[0] ?? null;
  const horasSinceLastRun = recentRun
    ? (Date.now() - new Date(recentRun.created_at).getTime()) / 3600000
    : 999;

  const { data: allActivePartners } = await svc()
    .from("profiles")
    .select("id, full_name, email, role, cpf, cnpj, trial_expires_at, created_at")
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .eq("is_active", true);

  const partnersComVencimento = (allActivePartners ?? []) as Partner[];

  if (horasSinceLastRun >= 12) {
    const vencendo = partnersComVencimento.filter(p => {
      const diasRestantes = Math.floor((efetivoVencimento(p).getTime() - now.getTime()) / 86400000);
      return diasRestantes >= 0 && diasRestantes <= 7;
    });

    if (vencendo.length > 0) {
      const { data: admins } = await svc()
        .from("profiles")
        .select("id")
        .eq("role", "ADMIN")
        .eq("is_active", true);

      if (admins?.length) {
        const lista = vencendo.map(p => {
          const dias = Math.max(Math.floor((efetivoVencimento(p).getTime() - now.getTime()) / 86400000), 0);
          return `${p.full_name ?? p.email} (${planoLabel(p.role)}) — ${dias === 0 ? "vence hoje" : `vence em ${dias}d`}`;
        }).join("; ");

        await svc().from("notifications").insert(
          admins.map((a: { id: string }) => ({
            user_id: a.id,
            title: `⚠️ ${vencendo.length} assinatura(s) vencendo`,
            message: `Partners com acesso próximo do vencimento: ${lista}. Acesse Financeiro → Assinaturas para renovar.`,
            type: "ASSINATURA_VENCENDO",
            action_url: "/financeiro",
            read: false,
          }))
        );
      }
    }
  }

  // ── 2. Cadência de cobrança: D-5 gera cobrança + envia, D-3 lembrete, D-1 aviso de bloqueio ──
  let zapEnviados = 0;
  const zapErros: string[] = [];

  const emCadencia = partnersComVencimento.filter(p => {
    const diasRestantes = Math.floor((efetivoVencimento(p).getTime() - now.getTime()) / 86400000);
    return diasRestantes >= 0 && diasRestantes <= 5;
  });

  for (const partner of emCadencia) {
    const dueDateStr = efetivoVencimento(partner).toISOString().split("T")[0];
    const diasRestantes = Math.floor((efetivoVencimento(partner).getTime() - now.getTime()) / 86400000);

    const sub = await getOrCreatePendingSubscription(svc(), partner, dueDateStr);
    if (!sub) { zapErros.push(`${partner.id}: falha ao gerar/obter cobrança`); continue; }
    if (sub.status !== "PENDING") continue; // já paga

    const stage: "D1" | "D3" | "D5" | null =
      diasRestantes <= 1 && !sub.zap_d1_sent_at ? "D1" :
      diasRestantes <= 3 && !sub.zap_d3_sent_at ? "D3" :
      diasRestantes <= 5 && !sub.zap_d5_sent_at ? "D5" :
      null;
    if (!stage) continue;

    const phone = await resolvePartnerPhone(svc(), partner.id);
    if (!phone) { zapErros.push(`${partner.id}: sem telefone`); continue; }

    const msgParams = {
      nome: partner.full_name ?? "Partner",
      plano: planoLabel(partner.role),
      dueDate: sub.due_date,
      valorCents: sub.amount_cents,
      pixEmv: sub.pix_emv,
      boletoBarcode: sub.boleto_barcode,
      boletoPdf: sub.boleto_pdf,
    };
    const msg =
      stage === "D5" ? buildCobrancaMessage(msgParams) :
      stage === "D3" ? buildLembreteMessage(msgParams) :
      buildAvisoBloqueioMessage(msgParams);

    const sent = await sendWhatsApp(phone, msg);
    const stageCol = stage === "D5" ? "zap_d5_sent_at" : stage === "D3" ? "zap_d3_sent_at" : "zap_d1_sent_at";

    if (sent) {
      await svc().from("partner_subscriptions").update({ [stageCol]: new Date().toISOString() }).eq("id", sub.id);
      zapEnviados++;
    } else {
      zapErros.push(`${partner.id}: falha Evolution API (${stage})`);
    }

    await svc().from("notifications").insert({
      user_id: partner.id,
      title: sent ? `WhatsApp de cobrança (${stage}) enviado ✅` : `Falha ao enviar WhatsApp (${stage}) ❌`,
      message: sent
        ? `Estágio ${stage} enviado para ${phone}. Vencimento: ${sub.due_date}`
        : `Não foi possível enviar WhatsApp (${stage}) para ${phone}.`,
      type: "ASSINATURA_ZAP",
      action_url: "/minha-assinatura",
      read: true,
    });
  }

  return NextResponse.json({
    ok: true,
    zap_enviados: zapEnviados,
    zap_erros: zapErros.length > 0 ? zapErros : undefined,
    partners_em_cadencia: emCadencia.length,
  });
}

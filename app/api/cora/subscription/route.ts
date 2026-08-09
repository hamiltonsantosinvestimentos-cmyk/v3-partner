import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";
import { getPlanoValor } from "@/lib/plano-valor";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — retorna cobrança vigente + histórico do partner
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: all } = await svc()
    .from("partner_subscriptions")
    .select("*")
    .eq("partner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(24);

  const latest = all?.[0] ?? null;
  return NextResponse.json({ subscription: latest, history: all ?? [] });
}

// POST — gera nova cobrança mensal para o partner
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, cpf, cnpj, email")
    .eq("id", user.id)
    .single();

  const p = profile as { role: string; full_name: string; cpf?: string; cnpj?: string; email?: string } | null;
  if (!p || !["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"].includes(p.role)) {
    return NextResponse.json({ error: "Apenas partners podem gerar cobranças de assinatura" }, { status: 403 });
  }

  // Verifica se já tem cobrança pendente
  const { data: existing } = await svc()
    .from("partner_subscriptions")
    .select("id, status, pix_emv, pix_qr_code, boleto_barcode, boleto_pdf")
    .eq("partner_id", user.id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ subscription: existing, already_pending: true });
  }

  const body = await req.json().catch(() => ({})) as { force?: boolean };

  // Calcula próximo vencimento (dia 10 do mês seguinte)
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1);
  dueDate.setDate(10);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const documento = p.cpf ?? p.cnpj ?? "";
  const valor = getPlanoValor(p.role);

  // Gera cobrança na Cora
  let coraData: { id?: string; pix?: { emv?: string; qr_code?: string }; payment_options?: { bank_slip?: { digitable?: string; url?: string } }; payment_url?: string } = {};
  try {
    const res = await coraFetch("/v2/invoices", {
      method: "POST",
      body: JSON.stringify({
        code: randomUUID().slice(0, 8).toUpperCase(),
        customer: {
          name: p.full_name,
          document: {
            identity: documento.replace(/\D/g, ""),
            type: documento.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ",
          },
          ...(p.email ? { contacts: [{ contact: p.email, type: "EMAIL" }] } : {}),
        },
        payment_terms: { due_date: dueDateStr, amount: valor },
        payment_options: {
          interest: { type: "MONTHLY_PERCENTAGE", value: 1 },
          fine: { type: "PERCENTAGE", value: 2 },
        },
        payment_forms: ["BANK_SLIP", "PIX"],
        services: [{ name: `V3 Partners — Mensalidade ${p.role === "PARTNER_PRO" ? "Partner PRO" : "Partner"}`, amount: valor }],
        notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
      }),
      idempotencyKey: randomUUID(),
    });
    if (res.ok) coraData = await res.json() as typeof coraData;
  } catch (e) {
    console.error("Erro Cora:", e);
  }

  // Salva no Supabase
  const { data: sub, error } = await svc().from("partner_subscriptions").insert({
    partner_id:      user.id,
    plano:           p.role,
    amount_cents:    valor,
    due_date:        dueDateStr,
    cora_invoice_id: coraData.id,
    status:          "PENDING",
    pix_emv:         coraData.pix?.emv,
    pix_qr_code:     coraData.pix?.qr_code,
    boleto_barcode:  coraData.payment_options?.bank_slip?.digitable,
    boleto_pdf:      coraData.payment_options?.bank_slip?.url,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: sub });
}

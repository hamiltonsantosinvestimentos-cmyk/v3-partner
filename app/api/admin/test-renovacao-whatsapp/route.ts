import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const INSTANCE = "v3-sdr-whatsapp";

async function sendWhatsApp(phone: string, text: string): Promise<{ ok: boolean; body: string }> {
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ number: phone, text }),
      }
    );
    const body = await res.text();
    return { ok: res.ok, body };
  } catch (e) {
    return { ok: false, body: String(e) };
  }
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function buildRenewalMessage(params: {
  nome: string;
  plano: string;
  dueDate: string;
  valorCents: number;
  pixEmv: string | null;
  boletoBarcode: string | null;
  boletoPdf: string | null;
}): string {
  const { nome, plano, dueDate, valorCents, pixEmv, boletoBarcode, boletoPdf } = params;
  const valor = (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataVenc = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
  const firstName = nome?.split(" ")[0] ?? "Partner";

  let msg = `Olá, *${firstName}*! 👋\n\n`;
  msg += `Sua assinatura *V3 Partners ${plano}* vence em *${dataVenc}*.\n\n`;
  msg += `Para manter seu acesso por mais *30 dias*, realize o pagamento de *${valor}*:\n\n`;

  if (pixEmv) {
    msg += `*🔵 PIX — copie o código abaixo:*\n${pixEmv}\n\n`;
  }

  if (boletoBarcode) {
    msg += `*📄 Boleto — código de barras:*\n${boletoBarcode}\n`;
    if (boletoPdf) {
      msg += `📎 PDF: ${boletoPdf}\n`;
    }
    msg += `\n`;
  }

  msg += `✅ Reconhecemos o pagamento automaticamente pelo extrato Cora e seu acesso é renovado na hora.\n\n`;
  msg += `Dúvidas? Fale com nossa equipe. 🤝\n`;
  msg += `_V3 Partners — Boutique institucional multiproduto_`;

  return msg;
}

// POST /api/admin/test-renovacao-whatsapp
// Body: { email: string } ou { partner_id: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: caller } = await svc()
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes((caller as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { email, partner_id } = await req.json() as { email?: string; partner_id?: string };

  // Busca o profile
  let profileQuery = svc().from("profiles").select("id, full_name, email, phone, cobranding_whatsapp, role");
  if (partner_id) {
    profileQuery = profileQuery.eq("id", partner_id);
  } else if (email) {
    profileQuery = profileQuery.eq("email", email);
  } else {
    return NextResponse.json({ error: "Informe email ou partner_id" }, { status: 400 });
  }

  const { data: profile } = await profileQuery.single();
  if (!profile) return NextResponse.json({ error: "Partner não encontrado" }, { status: 404 });

  type Profile = { id: string; full_name: string | null; email: string; phone: string | null; cobranding_whatsapp: string | null; role: string };
  const p = profile as Profile;

  // Busca última assinatura (qualquer status)
  const { data: sub } = await svc()
    .from("partner_subscriptions")
    .select("id, partner_id, plano, amount_cents, due_date, pix_emv, boleto_barcode, boleto_pdf, status")
    .eq("partner_id", p.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Telefone com fallback para partner_registrations
  let phoneRaw: string | null = p.cobranding_whatsapp ?? p.phone ?? null;
  if (!phoneRaw) {
    const { data: reg } = await svc()
      .from("partner_registrations")
      .select("telefone")
      .eq("email", p.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    phoneRaw = (reg as { telefone?: string | null } | null)?.telefone ?? null;
  }

  if (!phoneRaw) {
    return NextResponse.json({
      error: "Nenhum telefone encontrado",
      partner: { id: p.id, email: p.email, full_name: p.full_name },
    }, { status: 422 });
  }

  const phone = formatPhone(phoneRaw);

  // Se não tem assinatura, monta mensagem de teste genérica
  const planoLabel =
    sub?.plano === "PARTNER_PRO" ? "Partner PRO" :
    sub?.plano === "STARTER" ? "Starter" :
    sub?.plano === "ENTERPRISE" ? "Enterprise" :
    sub?.plano ?? p.role.replace("_", " ");

  const msg = buildRenewalMessage({
    nome: p.full_name ?? "Partner",
    plano: planoLabel,
    dueDate: sub?.due_date ?? new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    valorCents: sub?.amount_cents ?? 89700,
    pixEmv: sub?.pix_emv ?? null,
    boletoBarcode: sub?.boleto_barcode ?? null,
    boletoPdf: sub?.boleto_pdf ?? null,
  });

  const result = await sendWhatsApp(phone, msg);

  return NextResponse.json({
    ok: result.ok,
    partner: { id: p.id, email: p.email, full_name: p.full_name },
    phone_usado: phone,
    phone_origem: p.cobranding_whatsapp ? "cobranding_whatsapp" : p.phone ? "profiles.phone" : "partner_registrations",
    assinatura: sub ? { id: sub.id, status: sub.status, plano: sub.plano, due_date: sub.due_date } : null,
    evolution_response: result.body,
  });
}

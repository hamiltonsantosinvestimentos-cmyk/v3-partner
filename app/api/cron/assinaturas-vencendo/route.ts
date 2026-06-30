import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const INSTANCE = "v3-sdr-whatsapp";

async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
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
    return res.ok;
  } catch {
    return false;
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

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const em7dias = new Date(now);
  em7dias.setDate(em7dias.getDate() + 7);

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

  if (horasSinceLastRun >= 12) {
    const { data: partners } = await svc()
      .from("profiles")
      .select("id, full_name, email, role, trial_expires_at, created_at, is_active")
      .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
      .eq("is_active", true);

    const vencendo = (partners ?? []).filter(p => {
      const expires = p.trial_expires_at
        ? new Date(p.trial_expires_at).getTime()
        : new Date(p.created_at).getTime() + 30 * 86400000;
      const diasRestantes = Math.floor((expires - now.getTime()) / 86400000);
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
          const expires = p.trial_expires_at
            ? new Date(p.trial_expires_at).getTime()
            : new Date(p.created_at).getTime() + 30 * 86400000;
          const dias = Math.max(Math.floor((expires - now.getTime()) / 86400000), 0);
          const plano = p.role === "ENTERPRISE" ? "Enterprise" : p.role === "PARTNER_PRO" ? "Partner PRO" : p.role === "STARTER" ? "Starter" : "Partner";
          return `${p.full_name ?? p.email} (${plano}) — ${dias === 0 ? "vence hoje" : `vence em ${dias}d`}`;
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

  // ── 2. WhatsApp de renovação para cada partner com fatura pendente ──────────
  const em5dias = new Date(now);
  em5dias.setDate(em5dias.getDate() + 5);
  const todayStr = now.toISOString().split("T")[0];
  const em5diasStr = em5dias.toISOString().split("T")[0];

  const { data: subsVencendo } = await svc()
    .from("partner_subscriptions")
    .select("id, partner_id, plano, amount_cents, due_date, pix_emv, boleto_barcode, boleto_pdf")
    .eq("status", "PENDING")
    .lte("due_date", em5diasStr)
    .gte("due_date", todayStr);

  let zapEnviados = 0;
  const zapErros: string[] = [];

  for (const sub of subsVencendo ?? []) {
    // Evita spam: máximo 1 WhatsApp por partner a cada 23h
    const { data: jaMandou } = await svc()
      .from("notifications")
      .select("id")
      .eq("user_id", sub.partner_id)
      .eq("type", "ASSINATURA_ZAP")
      .gte("created_at", new Date(Date.now() - 23 * 3600000).toISOString())
      .limit(1)
      .maybeSingle();

    if (jaMandou) continue;

    const { data: profile } = await svc()
      .from("profiles")
      .select("full_name, phone, cobranding_whatsapp")
      .eq("id", sub.partner_id)
      .single();

    const phoneRaw = (profile as { cobranding_whatsapp?: string | null; phone?: string | null } | null)
      ?.cobranding_whatsapp ?? (profile as { phone?: string | null } | null)?.phone ?? null;

    if (!phoneRaw) {
      zapErros.push(`${sub.partner_id}: sem telefone`);
      continue;
    }

    const planoLabel =
      sub.plano === "PARTNER_PRO" ? "Partner PRO" :
      sub.plano === "STARTER" ? "Starter" :
      sub.plano === "ENTERPRISE" ? "Enterprise" : "Partner";

    const msg = buildRenewalMessage({
      nome: (profile as { full_name?: string | null } | null)?.full_name ?? "Partner",
      plano: planoLabel,
      dueDate: sub.due_date,
      valorCents: sub.amount_cents,
      pixEmv: sub.pix_emv,
      boletoBarcode: sub.boleto_barcode,
      boletoPdf: sub.boleto_pdf,
    });

    const sent = await sendWhatsApp(formatPhone(phoneRaw), msg);

    // Registra o envio na tabela de notificações (como log interno, lido=true)
    await svc().from("notifications").insert({
      user_id: sub.partner_id,
      title: sent ? "WhatsApp de renovação enviado ✅" : "Falha ao enviar WhatsApp de renovação ❌",
      message: sent
        ? `Mensagem de renovação enviada para ${formatPhone(phoneRaw)}. Vencimento: ${sub.due_date}`
        : `Não foi possível enviar WhatsApp para ${formatPhone(phoneRaw)}.`,
      type: "ASSINATURA_ZAP",
      action_url: "/minha-assinatura",
      read: true,
    });

    if (sent) {
      zapEnviados++;
    } else {
      zapErros.push(`${sub.partner_id}: falha Evolution API`);
    }
  }

  return NextResponse.json({
    ok: true,
    zap_enviados: zapEnviados,
    zap_erros: zapErros.length > 0 ? zapErros : undefined,
    subs_vencendo: (subsVencendo ?? []).length,
  });
}

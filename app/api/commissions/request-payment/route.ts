import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotification, notifyByRoles } from "@/lib/notify";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const requestSchema = z.object({
  total:    z.number().positive("Total deve ser positivo"),
  method:   z.enum(["PIX", "BOLETO"]),
  pix_key:  z.string().optional().nullable(),
  note:     z.string().max(500).optional().nullable(),
});

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email")
    .eq("id", user.id)
    .single();

  const role = (profile as { role: string } | null)?.role ?? "";
  if (!["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"].includes(role)) {
    return NextResponse.json({ error: "Apenas partners podem solicitar pagamento" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  const partnerName = (profile as { full_name: string | null } | null)?.full_name ?? "Partner";
  const methodLabel = d.method === "PIX" ? "Pix" : "Boleto";
  const totalFormatted = moeda(d.total);

  const notificationTitle = "Solicitação de pagamento de comissão";
  const notificationMessage = `Parceiro ${partnerName} solicitou pagamento de ${totalFormatted} via ${methodLabel}${d.pix_key ? ` — Chave Pix: ${d.pix_key}` : ""}${d.note ? ` | Obs: ${d.note}` : ""}`;

  // Notificação in-app para ADMIN/FINANCEIRO/GESTAO
  await notifyByRoles(["ADMIN", "FINANCEIRO", "GESTAO"], {
    type: "commission",
    title: notificationTitle,
    message: notificationMessage,
    action_url: "/comissoes",
  });

  // Notificação in-app de confirmação para o próprio partner
  await createNotification({
    user_id: user.id,
    type: "commission",
    title: "Solicitação de pagamento enviada",
    message: `Sua solicitação de ${totalFormatted} via ${methodLabel} foi enviada. Você receberá o pagamento em até 2 dias úteis.`,
    action_url: "/comissoes",
  });

  // E-mail para o admin financeiro (fire and forget)
  const svc = serviceClient();
  const { data: adminProfiles } = await svc
    .from("profiles")
    .select("id")
    .in("role", ["ADMIN", "FINANCEIRO"])
    .eq("is_active", true)
    .limit(3);

  if (adminProfiles?.length) {
    // Import send pattern from lib/email — using Resend directly matching the existing pattern
    const resendKey = process.env.RESEND_API_KEY;
    const FROM = process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>";
    if (resendKey) {
      const adminEmailFetches = adminProfiles.map(async (ap) => {
        try {
          const { data: adminAuth } = await svc.auth.admin.getUserById(ap.id);
          const adminEmail = adminAuth?.user?.email;
          if (!adminEmail) return;

          const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solicitação de Pagamento</title></head>
<body style="margin:0;padding:0;background:#07101E;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0C1929;border-radius:12px;overflow:hidden;border:1px solid #1B3050;">
    <div style="padding:24px 32px;border-bottom:1px solid #1B3050;background:#07101E;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:3px;height:24px;background:linear-gradient(180deg,#C4922E,#E5B96A);border-radius:2px;"></div>
        <span style="font-size:16px;font-weight:800;color:#E5B96A;letter-spacing:0.08em;">V3 PARTNERS</span>
      </div>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#C8D4E3;line-height:1.3;">Solicitação de Pagamento de Comissão</h2>
      <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
        O parceiro <strong style="color:#C8D4E3;">${partnerName}</strong> solicitou pagamento das suas comissões.
      </p>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1B3050;">
        <span style="font-size:13px;color:#7A96AF;">Parceiro</span>
        <span style="font-size:13px;font-weight:600;color:#C8D4E3;">${partnerName}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1B3050;">
        <span style="font-size:13px;color:#7A96AF;">Forma de pagamento</span>
        <span style="font-size:13px;font-weight:600;color:#C8D4E3;">${methodLabel}</span>
      </div>
      ${d.pix_key ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1B3050;">
        <span style="font-size:13px;color:#7A96AF;">Chave Pix</span>
        <span style="font-size:13px;font-weight:600;color:#C8D4E3;">${d.pix_key}</span>
      </div>` : ""}
      ${d.note ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1B3050;">
        <span style="font-size:13px;color:#7A96AF;">Observação</span>
        <span style="font-size:13px;font-weight:600;color:#C8D4E3;">${d.note}</span>
      </div>` : ""}
      <div style="margin-top:16px;padding:14px 18px;background:#13243D;border-radius:8px;border-left:3px solid #C4922E;">
        <p style="margin:0 0 4px;font-size:11px;color:#7A96AF;">Valor solicitado</p>
        <p style="margin:0;font-size:22px;font-weight:800;color:#C4922E;">${totalFormatted}</p>
      </div>
      <div style="margin-top:28px;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.v3partners.com.br"}/comissoes"
          style="display:inline-block;background:#C4922E;color:#07101E;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
          Ver Comissões →
        </a>
      </div>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #1B3050;background:#07101E;">
      <p style="margin:0;font-size:11px;color:#7A96AF;">V3 Partners — Plataforma Financeira &nbsp;·&nbsp; E-mail automático, não responda.</p>
    </div>
  </div>
</body>
</html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM,
              to: [adminEmail],
              subject: `💰 Solicitação de pagamento — ${partnerName} · ${totalFormatted}`,
              html,
            }),
          });
        } catch { /* silent */ }
      });

      // Fire and forget
      Promise.allSettled(adminEmailFetches);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitação enviada! Você receberá o pagamento em até 2 dias úteis.",
  });
}

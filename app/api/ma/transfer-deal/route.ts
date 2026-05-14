import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 30;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const NOTIFY_ROLES  = ["ADMIN", "GESTAO", "FINANCEIRO"] as const;

const MOTIVO_LABELS: Record<string, string> = {
  inadimplencia:  "Inadimplência — parceiro em atraso",
  cadastro_mesa:  "Cadastro via Mesa — parceiro sem acesso à plataforma",
  solicitacao:    "Solicitação do parceiro",
  reestruturacao: "Reestruturação de carteira",
  outro:          "Outro motivo",
};

function buildTransferEmail({
  dealCode, dealCompany, dealSector, dealValue,
  fromName, toName, toEmail,
  motivo, justificativa, executedBy,
}: {
  dealCode: string; dealCompany: string; dealSector: string; dealValue: number;
  fromName: string; toName: string; toEmail: string;
  motivo: string; justificativa: string; executedBy: string;
}) {
  const fmt = (v: number) =>
    v >= 1e9 ? `R$ ${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `R$ ${(v/1e6).toFixed(1)}M` : `R$ ${v.toLocaleString("pt-BR")}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Transferência de Deal — ${dealCode}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F0ECE4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#162744;padding:28px 32px;border-bottom:1px solid #243A66;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;">
            V3 Partners · Aviso Interno
          </p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#F0ECE4;">Transferência de Deal</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#7A8FA8;">Este email é gerado automaticamente pela plataforma.</p>
        </td></tr>

        <!-- Alert bar -->
        <tr><td style="background:rgba(201,168,76,0.12);border-bottom:1px solid #C9A84C30;padding:14px 32px;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#C9A84C;">
            ⚠ Requer ciência: Financeiro · Head de Ativos · Compliance
          </p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">

          <!-- Deal card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #243A66;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Deal</p>
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#F0ECE4;font-family:monospace;">${dealCode}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-bottom:10px;">
                    <p style="margin:0;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:.08em;">Empresa</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#F0ECE4;">${dealCompany}</p>
                  </td>
                  <td width="50%" style="padding-bottom:10px;">
                    <p style="margin:0;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:.08em;">Setor</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#F0ECE4;">${dealSector}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin:0;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:.08em;">Valor</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#C9A84C;">${fmt(dealValue)}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Transfer details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #243A66;border-radius:8px;margin-bottom:24px;">
            <tr>
              <td width="50%" style="padding:16px 20px;border-right:1px solid #243A66;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:.08em;">De (anterior)</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#EF4444;">${fromName}</p>
              </td>
              <td width="50%" style="padding:16px 20px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:.08em;">Para (novo)</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#10B981;">${toName}</p>
                ${toEmail ? `<p style="margin:4px 0 0;font-size:11px;color:#7A8FA8;">${toEmail}</p>` : ""}
              </td>
            </tr>
          </table>

          <!-- Motivo -->
          <div style="background:#09081A;border-left:3px solid #C9A84C;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Motivo</p>
            <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#F0ECE4;">${MOTIVO_LABELS[motivo] ?? motivo}</p>
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A8FA8;margin-bottom:4px;">Justificativa</p>
            <p style="margin:0;font-size:13px;color:#E8EDF5;line-height:1.6;">${justificativa}</p>
          </div>

          <hr style="border:none;border-top:1px solid #243A66;margin:0 0 20px;" />
          <p style="margin:0;font-size:11px;color:#7A8FA8;line-height:1.6;">
            Executado por: <strong style="color:#F0ECE4;">${executedBy}</strong><br />
            Data/hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (BRT)<br />
            Esta ação foi registrada no log de auditoria da plataforma.
          </p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#09081A;padding:20px 32px;border-top:1px solid #162744;">
          <p style="margin:0;font-size:10px;color:#7A8FA8;">
            V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 ·
            <a href="https://app.v3partners.com.br/mesa-ma" style="color:#C9A84C;text-decoration:none;">Acessar Mesa M&A</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();

  // Validar role do executor
  const { data: caller } = await db.from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id).single();

  if (!ALLOWED_ROLES.includes(caller?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Apenas ADMIN, Gestão ou Mesa podem transferir deals" }, { status: 403 });
  }

  const body = await req.json() as {
    deal_id: string;
    new_partner_id?: string;       // para parceiro com conta
    new_partner_name?: string;     // para parceiro sem conta (cadastro_mesa)
    new_partner_email?: string;
    motivo: string;
    justificativa: string;
    confirmar: boolean;
  };

  const { deal_id, new_partner_id, new_partner_name, new_partner_email, motivo, justificativa, confirmar } = body;

  if (!deal_id || !motivo || !justificativa?.trim() || !confirmar) {
    return NextResponse.json({ error: "Campos obrigatórios: deal_id, motivo, justificativa, confirmar" }, { status: 400 });
  }
  if (!new_partner_id && !new_partner_name) {
    return NextResponse.json({ error: "Informe o novo partner (existente ou externo)" }, { status: 400 });
  }

  // Buscar deal atual
  const { data: deal, error: dealErr } = await db
    .from("ma_deals")
    .select("id, code, target_company, title, sector, deal_value, assigned_to, asset_data, partner:profiles!assigned_to(full_name, email)")
    .eq("id", deal_id).single();

  if (dealErr || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // Dados do partner anterior
  const oldPartner = Array.isArray(deal.partner)
    ? (deal.partner[0] as { full_name?: string; email?: string })
    : (deal.partner as { full_name?: string; email?: string } | null);
  const fromName = oldPartner?.full_name ?? "Sem responsável";

  // Dados do novo partner
  let toName  = new_partner_name ?? "";
  let toEmail = new_partner_email ?? "";

  if (new_partner_id) {
    const { data: np } = await db.from("profiles")
      .select("full_name, email").eq("id", new_partner_id).single();
    toName  = np?.full_name ?? toName;
    toEmail = np?.email ?? toEmail;
  }

  // Atualizar deal
  const currentAssetData = (deal.asset_data ?? {}) as Record<string, unknown>;
  const transferEntry = {
    from_id:     deal.assigned_to ?? null,
    from_name:   fromName,
    to_id:       new_partner_id ?? null,
    to_name:     toName,
    to_email:    toEmail,
    motivo,
    justificativa,
    executed_by: caller?.full_name ?? user.email,
    executed_at: new Date().toISOString(),
  };

  const transferHistory = Array.isArray(currentAssetData.transfer_history)
    ? [...(currentAssetData.transfer_history as unknown[]), transferEntry]
    : [transferEntry];

  const updatePayload: Record<string, unknown> = {
    asset_data: { ...currentAssetData, transfer_history: transferHistory },
  };
  if (new_partner_id) updatePayload.assigned_to = new_partner_id;

  const { error: updateErr } = await db
    .from("ma_deals")
    .update(updatePayload)
    .eq("id", deal_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log de auditoria
  try {
    await db.from("audit_logs").insert({
      user_id:     user.id,
      action:      "DEAL_TRANSFER",
      table_name:  "ma_deals",
      record_id:   deal_id,
      old_values:  { assigned_to: deal.assigned_to, responsible: fromName },
      new_values:  { assigned_to: new_partner_id ?? null, responsible: toName, motivo, justificativa },
    });
  } catch { /* não bloquear se audit falhar */ }

  // Enviar emails para diretores
  const resendKey = process.env.RESEND_API_KEY;
  let emailsEnviados = 0;

  if (resendKey) {
    const { data: directors } = await db
      .from("profiles")
      .select("email, full_name, role")
      .in("role", [...NOTIFY_ROLES])
      .not("email", "is", null);

    const emailHtml = buildTransferEmail({
      dealCode:    deal.code ?? deal_id.slice(0, 8),
      dealCompany: deal.target_company ?? deal.title ?? "Confidencial",
      dealSector:  deal.sector ?? "—",
      dealValue:   Number(deal.deal_value ?? 0),
      fromName,
      toName,
      toEmail,
      motivo,
      justificativa,
      executedBy:  caller?.full_name ?? user.email ?? "Sistema",
    });

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    const recipients = (directors ?? []).map(d => d.email).filter(Boolean) as string[];

    if (recipients.length > 0) {
      try {
        await resend.emails.send({
          from:    "V3 Partners Plataforma <noreply@v3partners.com.br>",
          to:      recipients,
          subject: `[Transferência de Deal] ${deal.code} — ${deal.target_company ?? deal.title}`,
          html:    emailHtml,
        });
        emailsEnviados = recipients.length;
      } catch (err) {
        console.error("[transfer-deal] email error:", err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    transfer: transferEntry,
    emails_sent: emailsEnviados,
  });
}

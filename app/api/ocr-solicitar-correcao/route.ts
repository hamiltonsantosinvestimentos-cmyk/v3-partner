import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return { user, profile };
}

function buildEmail(partnerName: string, proposalCode: string, proposalTitle: string, docLabel: string, motivo: string, proposalUrl: string) {
  const baseStyle = `font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4; margin: 0; padding: 0;`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documento Pendente — V3 Partners</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="${baseStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35; border: 1px solid #243A66; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background:#162744; padding: 28px 32px; border-bottom: 1px solid #243A66;">
              <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#C9A84C;">V3 Partners · Mesa de Crédito</p>
              <h1 style="margin:8px 0 0; font-size:22px; font-weight:700; color:#F0ECE4;">📄 Documento Pendente de Correção</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin:0 0 20px; font-size:14px; color:#7A8FA8; line-height:1.6;">
                Olá, <strong style="color:#F0ECE4;">${partnerName}</strong>.<br />
                Nossa equipe identificou uma pendência no documento da proposta abaixo.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744; border:1px solid #243A66; border-radius:8px; margin-bottom:24px;">
                <tr><td style="padding:16px 20px; border-bottom:1px solid #243A66;">
                  <p style="margin:0; font-size:11px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.1em;">Proposta</p>
                  <p style="margin:4px 0 0; font-size:15px; font-weight:700; color:#F0ECE4;">${proposalCode} — ${proposalTitle}</p>
                </td></tr>
                <tr><td style="padding:16px 20px; border-bottom:1px solid #243A66;">
                  <p style="margin:0; font-size:11px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.1em;">Documento com Pendência</p>
                  <p style="margin:4px 0 0; font-size:15px; font-weight:700; color:#C9A84C;">📎 ${docLabel}</p>
                </td></tr>
                <tr><td style="padding:16px 20px;">
                  <p style="margin:0; font-size:11px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.1em;">Motivo</p>
                  <p style="margin:4px 0 0; font-size:14px; color:#F0ECE4; line-height:1.5;">${motivo}</p>
                </td></tr>
              </table>

              <p style="margin:0 0 24px; font-size:14px; color:#7A8FA8; line-height:1.6;">
                Por favor, acesse a plataforma, localize esta proposta na aba <strong style="color:#F0ECE4;">Documentos</strong> e faça o upload do documento correto.
              </p>

              <div style="text-align:center; margin-bottom:24px;">
                <a href="${proposalUrl}" style="display:inline-block; background:#C9A84C; color:#09081A; font-size:14px; font-weight:700; padding:14px 32px; border-radius:8px; text-decoration:none; letter-spacing:0.03em;">
                  Acessar Proposta →
                </a>
              </div>

              <p style="margin:0; font-size:12px; color:#7A8FA8; line-height:1.5; border-top:1px solid #243A66; padding-top:20px;">
                Em caso de dúvidas, entre em contato com a Mesa de Crédito V3 Partners.<br />
                <span style="color:#C9A84C;">V3 Partners Soluções Ltda</span> · CNPJ 14.219.287/0001-50
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ADMIN_ROLES.includes((profile as { role?: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { proposal_id, proposal_code, proposal_title, partner_id, doc_label, motivo } = body as {
    proposal_id: string;
    proposal_code: string;
    proposal_title: string;
    partner_id: string;
    doc_label: string;
    motivo: string;
  };

  if (!proposal_id || !partner_id || !doc_label || !motivo) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const db = svc();

  // 1. Busca dados do partner
  const { data: partnerProfile } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", partner_id)
    .single();

  const partnerName = (partnerProfile as { full_name?: string } | null)?.full_name ?? "Partner";
  const partnerEmail = (partnerProfile as { email?: string } | null)?.email ?? null;

  // 2. Cria notificação interna
  await db.from("notifications").insert({
    user_id: partner_id,
    title: "📄 Documento pendente de correção",
    message: `Proposta ${proposal_code}: o documento "${doc_label}" precisa ser corrigido. Motivo: ${motivo}`,
    type: "warning",
    read: false,
    action_url: `/mesa-credito/nivel-1`,
  });

  // 3. Busca metadata atual e adiciona pendência OCR
  const { data: proposalData } = await db
    .from("credit_desk_proposals")
    .select("metadata")
    .eq("id", proposal_id)
    .single();

  const currentMeta = (proposalData as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};
  const pendenciasOcr = (currentMeta.pendencias_ocr as Record<string, unknown> ?? {});
  const docKey = `${doc_label.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
  pendenciasOcr[docKey] = {
    doc_label,
    motivo,
    status: "pendente",
    created_at: new Date().toISOString(),
    corrigido_at: null,
  };

  // 4. Avança proposta para PENDENCIA e salva metadata
  await db
    .from("credit_desk_proposals")
    .update({
      stage: "PENDENCIA",
      metadata: { ...currentMeta, pendencias_ocr: pendenciasOcr },
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposal_id);

  // 4. Envia e-mail se Resend estiver configurado
  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";

  if (resendKey && partnerEmail) {
    try {
      const proposalUrl = `${appUrl}/mesa-credito/nivel-1`;
      const html = buildEmail(partnerName, proposal_code, proposal_title, doc_label, motivo, proposalUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "V3 Partners <noreply@v3partners.com.br>",
          to: [partnerEmail],
          subject: `📄 Documento pendente — Proposta ${proposal_code}`,
          html,
        }),
      });

      emailSent = res.ok;
    } catch {
      // e-mail falhou mas notificação interna foi criada
    }
  }

  return NextResponse.json({
    ok: true,
    notificacao: true,
    email: emailSent,
    stage_atualizado: "PENDENCIA",
  });
}

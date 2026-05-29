import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 30;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — chamado pelo W11 n8n quando documento chega pelo link público
// Header obrigatório: x-cron-secret
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json() as {
    deal_id:     string;
    doc_id:      string;
    file_name:   string;
    file_size:   number;
    mime_type:   string;
    token_label: string;
    ip_address?: string;
  };

  const { deal_id, doc_id, file_name, file_size, mime_type, token_label } = body;
  if (!deal_id || !file_name) {
    return NextResponse.json({ error: "deal_id e file_name obrigatórios" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ ok: true, mode: "demo" });

  // Busca dados do deal
  const { data: deal } = await svc()
    .from("ma_deals")
    .select("v3_code, code, target_company, sector, assigned_to, created_by")
    .eq("id", deal_id)
    .single();

  const dealCodigo    = (deal?.v3_code ?? deal?.code ?? deal_id.slice(0, 8)).toString();
  const dealNome      = (deal?.target_company ?? "Deal").toString();
  const fileKb        = Math.round(file_size / 1024);
  const isOcr         = mime_type === "application/pdf";
  const responsavelId = (deal?.assigned_to ?? deal?.created_by) as string | undefined;

  // Insert de timeline (fire-and-forget — não bloqueia o email)
  if (responsavelId) {
    void Promise.resolve(
      svc().from("notifications").insert({
        user_id:    responsavelId,
        title:      `Documento recebido: ${file_name}`,
        message:    `${file_name} (${fileKb} KB) via link "${token_label}"${isOcr ? " · OCR W9 disparado" : ""}`,
        type:       "deal",
        read:       false,
        action_url: `/mesa-ma?deal=${deal_id}`,
      })
    ).catch(() => {});
  }

  const hoje = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

  const html = buildUploadNotifyEmail({
    dealCodigo, dealNome, fileName: file_name, fileKb,
    mimeType: mime_type, tokenLabel: token_label, hoje,
    docId: doc_id, isOcr,
  });

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);

  try {
    await resend.emails.send({
      from:    "V3 Partners Mesa M&A <noreply@v3partners.com.br>",
      replyTo: "deal@v3partners.com.br",
      to:      ["deal@v3partners.com.br", "joao.lemos@v3partners.com.br"],
      subject: `[Upload] ${file_name} recebido — ${dealCodigo}`,
      html,
    });
    return NextResponse.json({ ok: true, deal_code: dealCodigo });
  } catch (err) {
    console.error("[upload-notify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar email" },
      { status: 500 }
    );
  }
}

function buildUploadNotifyEmail(p: {
  dealCodigo: string;
  dealNome:   string;
  fileName:   string;
  fileKb:     number;
  mimeType:   string;
  tokenLabel: string;
  hoje:       string;
  docId:      string;
  isOcr:      boolean;
}) {
  const ext = p.fileName.split(".").pop()?.toUpperCase() ?? "DOC";
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/mesa-ma`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Documento recebido — ${p.dealCodigo}</title></head>
<body style="margin:0;padding:0;background:#07101E;font-family:'DM Sans',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07101E">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="max-width:560px;width:100%;background:#0C1929;border:1px solid #1B3050;border-radius:12px;overflow:hidden;">
      <!-- Header -->
      <tr>
        <td bgcolor="#07101E" style="padding:24px 28px;border-bottom:2px solid #C9A84C;">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C9A84C;">V3 Partners · Mesa M&amp;A</p>
          <h1 style="margin:6px 0 0;font-size:18px;font-weight:700;color:#F5F1E8;">Documento recebido via link de upload</h1>
          <p style="margin:4px 0 0;font-size:11px;color:#7A96AF;">${p.hoje} · BRT</p>
        </td>
      </tr>
      <!-- Deal card -->
      <tr>
        <td style="padding:24px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 bgcolor="#162744" style="background:#162744;border:1px solid #243A66;border-radius:8px;">
            <tr><td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7A96AF;">Deal</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#F5F1E8;">${p.dealCodigo}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#9BAFC5;">${p.dealNome}</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;display:inline-block;background:#1E3A5A;color:#C9A84C;font-size:13px;font-weight:700;padding:6px 12px;border-radius:6px;">.${ext}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
      <!-- File info -->
      <tr>
        <td style="padding:20px 28px 0;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Arquivo recebido</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 bgcolor="#0C1929" style="background:#0C1929;border:1px solid #1A3050;border-radius:8px;">
            <tr><td style="padding:14px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px;border-bottom:1px solid #1A3050;">
                    <p style="margin:0;font-size:11px;color:#9BAFC5;">Nome</p>
                    <p style="margin:3px 0 0;font-size:13px;color:#F5F1E8;font-weight:600;">${p.fileName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%">
                          <p style="margin:0;font-size:10px;color:#9BAFC5;">Tamanho</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#E8EDF5;">${p.fileKb} KB</p>
                        </td>
                        <td width="33%">
                          <p style="margin:0;font-size:10px;color:#9BAFC5;">Tipo</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#E8EDF5;">${ext}</p>
                        </td>
                        <td width="33%">
                          <p style="margin:0;font-size:10px;color:#9BAFC5;">Link usado</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#E8EDF5;">${p.tokenLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
      ${p.isOcr ? `
      <!-- OCR badge -->
      <tr>
        <td style="padding:16px 28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="#0F2A1A" style="background:#0F2A1A;border:1px solid #1D4A2A;border-radius:8px;padding:10px 16px;">
                <p style="margin:0;font-size:11px;color:#5FCA8A;">⚡ PDF detectado — OCR W9 disparado automaticamente</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ""}
      <!-- CTA -->
      <tr>
        <td style="padding:24px 28px;">
          <a href="${portalUrl}" style="display:inline-block;background:#C9A84C;color:#07101E;font-family:'DM Sans',Arial,sans-serif;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Ver deal na Mesa M&amp;A
          </a>
          <p style="margin:10px 0 0;font-size:10px;color:#7A96AF;">Doc ID: ${p.docId}</p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td bgcolor="#07101E" style="background:#07101E;padding:18px 28px;border-top:1px solid #1B3050;">
          <p style="margin:0;font-size:10px;color:#3D5A73;line-height:1.6;">
            V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br/>
            <a href="mailto:deal@v3partners.com.br" style="color:#C9A84C;text-decoration:none;">deal@v3partners.com.br</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

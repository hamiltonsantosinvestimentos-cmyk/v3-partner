import { NextRequest, NextResponse } from "next/server";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

// POST { dealCode, dealName, partnerName, partnerEmail, sector, dealValue }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dealCode, dealName, partnerName, partnerEmail, sector, dealValue } = body as {
    dealCode: string;
    dealName: string;
    partnerName: string;
    partnerEmail: string;
    sector: string;
    dealValue: string | number;
  };

  // Se não há chave Resend ou estamos em demo, simular e retornar
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ ok: true, mode: "demo", dealCode });
  }

  // Templates de email
  const baseStyle = `
    font-family: 'DM Sans', Arial, sans-serif;
    background: #09081A;
    color: #F0ECE4;
    margin: 0;
    padding: 0;
  `;

  function buildPartnerEmail() {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deal Submetido — V3 Partners</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="${baseStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35; border: 1px solid #243A66; border-radius: 12px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#162744; padding: 28px 32px; border-bottom: 1px solid #243A66;">
              <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#C9A84C;">V3 Partners · Mesa M&A</p>
              <h1 style="margin:8px 0 0; font-size:22px; font-weight:700; color:#F0ECE4;">Deal Submetido com Sucesso</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin:0 0 20px; font-size:14px; color:#7A8FA8; line-height:1.6;">
                Olá, <strong style="color:#F0ECE4;">${partnerName}</strong>.<br />
                Seu deal foi recebido pela Mesa M&A da V3 Partners e está em análise.
              </p>

              <!-- Deal card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744; border: 1px solid #243A66; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin:0 0 4px; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#C9A84C;">Código do Deal</p>
                    <p style="margin:0 0 16px; font-size:20px; font-weight:700; color:#F0ECE4; font-family:monospace;">${dealCode}</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-bottom: 12px;">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Empresa</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${dealName}</p>
                        </td>
                        <td width="50%" style="padding-bottom: 12px;">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Setor</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${sector}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Valor Pretendido</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#C9A84C;">R$ ${dealValue}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px; font-size:13px; color:#7A8FA8; line-height:1.6;">
                Nossa equipe irá analisar as informações e entrar em contato em até <strong style="color:#F0ECE4;">2 dias úteis</strong>.
                Guarde o código acima para acompanhamento.
              </p>

              <!-- Divider -->
              <hr style="border:none; border-top: 1px solid #243A66; margin: 24px 0;" />

              <p style="margin:0; font-size:11px; color:#7A8FA8; line-height:1.5;">
                V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br />
                Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ<br />
                <a href="https://v3partners.com.br" style="color:#C9A84C; text-decoration:none;">v3partners.com.br</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  function buildMesaEmail() {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Novo Deal — ${dealCode}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="${baseStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35; border: 1px solid #243A66; border-radius: 12px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#162744; padding: 28px 32px; border-bottom: 1px solid #243A66;">
              <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#C9A84C;">Novo Deal Recebido</p>
              <h1 style="margin:8px 0 0; font-size:22px; font-weight:700; color:#F0ECE4;">${dealCode}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744; border: 1px solid #243A66; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-bottom: 12px;">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Empresa</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${dealName}</p>
                        </td>
                        <td width="50%" style="padding-bottom: 12px;">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Setor</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${sector}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Valor</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#C9A84C;">R$ ${dealValue}</p>
                        </td>
                        <td width="50%">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Partner</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${partnerName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px; font-size:13px; color:#7A8FA8;">
                Contato do partner: <a href="mailto:${partnerEmail}" style="color:#C9A84C;">${partnerEmail}</a>
              </p>

              <a href="https://v3partners.com.br/mesa-ma" style="display:inline-block; background:#C9A84C; color:#09081A; font-weight:700; font-size:13px; padding: 12px 28px; border-radius: 8px; text-decoration:none;">
                Acessar Mesa M&A
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    const partnerNotifyHtmlGate = auditHtml(buildPartnerEmail());
    const mesaNotifyHtmlGate = auditHtml(buildMesaEmail());
    if (partnerNotifyHtmlGate.blocking.length > 0) console.error("[notify-deal partner] Brand Guardian bloqueou:", partnerNotifyHtmlGate.blocking);
    if (mesaNotifyHtmlGate.blocking.length > 0) console.error("[notify-deal mesa] Brand Guardian bloqueou:", mesaNotifyHtmlGate.blocking);
    await Promise.all([
      resend.emails.send({
        from: "V3 Partners <noreply@v3partners.com.br>",
        to: partnerEmail,
        subject: auditText(`Deal ${dealCode} recebido: V3 Partners`).corrected,
        html: partnerNotifyHtmlGate.corrected,
      }),
      resend.emails.send({
        from: "V3 Partners Plataforma <noreply@v3partners.com.br>",
        to: "deal@v3partners.com.br",
        subject: auditText(`[Novo Deal] ${dealCode}: ${dealName} · ${sector}`).corrected,
        html: mesaNotifyHtmlGate.corrected,
      }),
    ]);

    return NextResponse.json({ ok: true, mode: "production", dealCode });
  } catch (err) {
    console.error("[notify-deal] Erro ao enviar email:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}

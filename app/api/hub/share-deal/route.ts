import { NextRequest, NextResponse } from "next/server";

// POST { dealId, empresaNome, setor, valorEstimado, sugestaoTese, emails[] }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    dealId: string;
    empresaNome: string;
    setor: string;
    valorEstimado: number;
    sugestaoTese: string;
    emails: string[];
  };

  const { dealId, empresaNome, setor, valorEstimado, sugestaoTese, emails } = body;

  if (!emails?.length || !empresaNome) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: true, mode: "demo", sent: emails.length });
  }

  const setorlabels: Record<string, string> = {
    credito_recebiveis: "Crédito e Recebíveis",
    real_estate: "Real Estate",
    mineracao_commodities: "Mineração e Commodities",
    ma_cross_border: "M&A Cross-Border",
  };

  const formatCurrency = (v: number) =>
    v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M` : `R$ ${v.toLocaleString("pt-BR")}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Deal V3 Partners — ${empresaNome}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F0ECE4;margin:0;padding:40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#162744;padding:28px 32px;border-bottom:1px solid #243A66;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#C9A84C;">Hub de Deals · V3 Partners</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#F0ECE4;">Deal Compartilhado</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Deal info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #243A66;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C9A84C;">Empresa</p>
                    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F0ECE4;">${empresaNome}</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-bottom:12px;">
                          <p style="margin:0;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:0.08em;">Setor</p>
                          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#F0ECE4;">${setorlabels[setor] ?? setor}</p>
                        </td>
                        <td width="50%" style="padding-bottom:12px;">
                          <p style="margin:0;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:0.08em;">Valor Estimado</p>
                          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#C9A84C;">${formatCurrency(valorEstimado)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Tese -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#09081A;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C9A84C;">Tese de Investimento</p>
                    <p style="margin:0;font-size:13px;color:#F0ECE4;line-height:1.7;">${sugestaoTese}</p>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #243A66;margin:24px 0;">

              <p style="margin:0;font-size:11px;color:#7A8FA8;line-height:1.6;">
                V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br>
                Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ<br>
                <a href="https://v3partners.com.br" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: "V3 Partners Hub <noreply@v3partners.com.br>",
      to: emails,
      subject: `[Hub V3] Deal — ${empresaNome} · ${setorlabels[setor] ?? setor}`,
      html,
    });

    return NextResponse.json({ ok: true, mode: "production", sent: emails.length, dealId });
  } catch (err) {
    console.error("[hub/share-deal] Erro:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}

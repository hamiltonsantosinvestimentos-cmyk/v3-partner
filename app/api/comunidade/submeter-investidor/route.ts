import { NextRequest, NextResponse } from "next/server";

// POST { perfil, codigo }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { perfil, codigo } = body as { perfil: Record<string, unknown>; codigo: string };

  const IS_DEMO =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

  if (IS_DEMO) {
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ ok: true, mode: "demo", codigo });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await (supabase as any)
      .from("comunidade_prospects")
      .insert({
        codigo,
        tipo: "investidor",
        perfil,
        created_at: new Date().toISOString(),
      });

    if (dbError) throw dbError;

    // Notificação por email (usa Resend se disponível)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);

      const nomeContato = String(perfil.contato_nome ?? "");
      const emailContato = String(perfil.contato_email ?? "");
      const tipoInvestidor = String(perfil.tipo_investidor ?? "");

      const labelTipo: Record<string, string> = {
        pessoa_fisica: "Pessoa Física",
        pessoa_juridica: "Pessoa Jurídica",
        fundo: "Fundo de Investimento",
        family_office: "Family Office",
      };

      const baseStyle =
        "font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4; margin: 0; padding: 0;";

      const htmlMesa = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Novo Investidor — ${codigo}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="${baseStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35; border: 1px solid #243A66; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background:#162744; padding: 28px 32px; border-bottom: 1px solid #243A66;">
              <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#C9A84C;">Novo Investidor Registrado</p>
              <h1 style="margin:8px 0 0; font-size:22px; font-weight:700; color:#F0ECE4;">${codigo}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744; border: 1px solid #243A66; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-bottom: 12px;">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Nome / Contato</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${nomeContato}</p>
                        </td>
                        <td width="50%" style="padding-bottom: 12px;">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Tipo</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#F0ECE4;">${labelTipo[tipoInvestidor] ?? tipoInvestidor}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Ticket Mín.</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#C9A84C;">R$ ${String(perfil.ticket_min ?? "—")}</p>
                        </td>
                        <td width="50%">
                          <p style="margin:0; font-size:10px; color:#7A8FA8; text-transform:uppercase; letter-spacing:0.08em;">Ticket Máx.</p>
                          <p style="margin:4px 0 0; font-size:13px; font-weight:600; color:#C9A84C;">R$ ${String(perfil.ticket_max ?? "—")}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px; font-size:13px; color:#7A8FA8;">
                Contato: <a href="mailto:${emailContato}" style="color:#C9A84C;">${emailContato}</a>
              </p>
              <a href="https://v3partners.com.br/comunidade" style="display:inline-block; background:#C9A84C; color:#09081A; font-weight:700; font-size:13px; padding: 12px 28px; border-radius: 8px; text-decoration:none;">
                Ver na Plataforma
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

      await resend.emails.send({
        from: "V3 Partners Plataforma <noreply@v3partners.com.br>",
        to: "mesa@v3partners.com.br",
        subject: `[Novo Investidor] ${codigo} — ${nomeContato} · ${labelTipo[tipoInvestidor] ?? tipoInvestidor}`,
        html: htmlMesa,
      });
    }

    return NextResponse.json({ ok: true, mode: "production", codigo });
  } catch (err) {
    console.error("[submeter-investidor] Erro:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}

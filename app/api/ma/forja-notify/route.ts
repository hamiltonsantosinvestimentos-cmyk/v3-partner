import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ForjaNotifyPayload {
  deal_id:         string;
  score:           number;
  recommendation:  string;
  missing:         Array<{ field: string; impact: string; priority: string }>;
  corrected?:      Array<{ field: string; original: string; corrected: string; reason: string }>;
  doc_insights?:   Array<{ doc: string; finding: string }>;
  upload_token?:   string; // se já existe link de upload gerado
}

// ─── Template de Email ────────────────────────────────────────────────────────

function buildForjaEmail(params: {
  destinatarioNome: string;
  dealCodigo:        string;
  score:             number;
  recommendation:    string;
  pendencias:        string[];
  docInsights:       string[];
  portalUrl:         string;
  uploadUrl?:        string;
  tipo:              "mesa" | "partner" | "cliente";
}) {
  const {
    destinatarioNome, dealCodigo, score, recommendation,
    pendencias, docInsights, portalUrl, uploadUrl, tipo,
  } = params;

  const badgeColor  = score >= 60 ? "#2D6A4F" : score >= 40 ? "#7B4F00" : "#7B1D1D";
  const badgeTxt    = score >= 60 ? "#A8D5B5" : score >= 40 ? "#F9C74F" : "#F4A0A0";
  const recLabel    = recommendation === "APROVADO" ? "Aprovado" :
                      recommendation === "APROVADO_COM_RESSALVAS" ? "Aprovado com ressalvas" :
                      recommendation === "PENDENTE" ? "Pendente" : "Bloqueado";

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Seção de pendências
  const pendenciasHtml = pendencias.slice(0, 6).map(p => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #1A3050;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="16" valign="top" style="padding-top: 1px;">
              <span style="display:inline-block; width:6px; height:6px; background:#C9A84C; border-radius:50%; margin-top:5px;"></span>
            </td>
            <td style="font-size:13px; color:#C8D4E3; line-height:1.5; padding-left:8px;">${p}</td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  // Seção de achados dos documentos (apenas para mesa interna)
  const insightsHtml = tipo === "mesa" && docInsights.length > 0
    ? `
    <tr>
      <td style="padding: 24px 32px 0;">
        <p style="margin:0 0 12px; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#C9A84C;">Achados dos Documentos</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C1929; border:1px solid #1A3050; border-radius:8px;">
          <tr><td style="padding:16px 20px;">
            ${docInsights.slice(0, 4).map(i => `<p style="margin:0 0 8px; font-size:12px; color:#7A96AF; line-height:1.5;">• ${i}</p>`).join("")}
          </td></tr>
        </table>
      </td>
    </tr>`
    : "";

  // CTA principal
  const ctaHtml = uploadUrl && (tipo === "partner" || tipo === "cliente")
    ? `<a href="${uploadUrl}" style="display:inline-block; background:#C9A84C; color:#07101E; font-family:'DM Sans',Arial,sans-serif; font-weight:700; font-size:14px; padding:14px 32px; border-radius:8px; text-decoration:none; letter-spacing:0.02em;">Enviar documentos agora</a>`
    : `<a href="${portalUrl}" style="display:inline-block; background:#C9A84C; color:#07101E; font-family:'DM Sans',Arial,sans-serif; font-weight:700; font-size:14px; padding:14px 32px; border-radius:8px; text-decoration:none; letter-spacing:0.02em;">Acessar o portal</a>`;

  const bodyText = tipo === "mesa"
    ? `O FORJA concluiu a validação do deal abaixo. Revise as pendências e autorize a análise documental para avançar na due diligence.`
    : tipo === "partner"
    ? `A análise preliminar do deal foi concluída. Para avançarmos na operação, precisamos dos documentos listados abaixo. Utilize o link seguro para envio direto.`
    : `A V3 Partners recebeu e analisou preliminarmente a sua operação. Para continuarmos, precisamos de alguns documentos complementares.`;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pendências de Due Diligence — ${dealCodigo}</title>
</head>
<body style="margin:0; padding:0; background-color:#07101E; font-family:'DM Sans',Arial,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07101E" style="background-color:#07101E;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <!-- Container principal -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px; width:100%; background-color:#0C1929; border:1px solid #1B3050; border-radius:12px; overflow:hidden;">

        <!-- Header -->
        <tr>
          <td bgcolor="#07101E" style="background-color:#07101E; padding:28px 32px; border-bottom:2px solid #C9A84C;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0; font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#C9A84C; font-family:'DM Sans',Arial,sans-serif;">V3 Partners · Mesa M&amp;A</p>
                  <h1 style="margin:6px 0 0; font-size:20px; font-weight:700; color:#F5F1E8; font-family:'DM Sans',Arial,sans-serif;">Pendências de Due Diligence</h1>
                  <p style="margin:4px 0 0; font-size:12px; color:#7A96AF; font-family:'DM Sans',Arial,sans-serif;">${hoje}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Saudação -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0; font-size:14px; color:#C8D4E3; line-height:1.65; font-family:'DM Sans',Arial,sans-serif;">
              Olá, <strong style="color:#F5F1E8;">${destinatarioNome}</strong>.
            </p>
            <p style="margin:12px 0 0; font-size:14px; color:#7A96AF; line-height:1.65; font-family:'DM Sans',Arial,sans-serif;">
              ${bodyText}
            </p>
          </td>
        </tr>

        <!-- Card do deal + score -->
        <tr>
          <td style="padding:20px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   bgcolor="#162744" style="background-color:#162744; border:1px solid #243A66; border-radius:8px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="60%">
                        <p style="margin:0; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#7A96AF; font-family:'DM Sans',Arial,sans-serif;">Código do deal</p>
                        <p style="margin:4px 0 0; font-size:18px; font-weight:700; color:#F5F1E8; font-family:'DM Sans',Arial,sans-serif;">${dealCodigo}</p>
                      </td>
                      <td width="40%" align="right">
                        <table role="presentation" cellpadding="0" cellspacing="0" align="right">
                          <tr>
                            <td bgcolor="${badgeColor}" style="background-color:${badgeColor}; border-radius:6px; padding:8px 16px;" align="center">
                              <p style="margin:0; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:${badgeTxt}; font-family:'DM Sans',Arial,sans-serif;">${recLabel}</p>
                              <p style="margin:2px 0 0; font-size:22px; font-weight:800; color:${badgeTxt}; font-family:'DM Sans',Arial,sans-serif;">${score}<span style="font-size:12px; font-weight:400;">/100</span></p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pendências -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#C9A84C; font-family:'DM Sans',Arial,sans-serif;">
              Documentos e informações necessários (${pendencias.length} ${pendencias.length === 1 ? "item" : "itens"})
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   bgcolor="#0C1929" style="background-color:#0C1929; border:1px solid #1A3050; border-radius:8px;">
              <tr><td style="padding:4px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${pendenciasHtml}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        ${insightsHtml}

        <!-- CTA -->
        <tr>
          <td style="padding:28px 32px;">
            ${ctaHtml}
            ${uploadUrl && (tipo === "partner" || tipo === "cliente")
              ? `<p style="margin:12px 0 0; font-size:11px; color:#7A96AF; font-family:'DM Sans',Arial,sans-serif;">Link seguro e temporário. Válido por 14 dias.</p>`
              : ""}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;">
            <hr style="border:none; border-top:1px solid #1B3050; margin:0;" />
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="#07101E" style="background-color:#07101E; padding:20px 32px; border-top:1px solid #1B3050;">
            <p style="margin:0; font-size:11px; color:#3D5A73; line-height:1.6; font-family:'DM Sans',Arial,sans-serif;">
              V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br />
              Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ<br />
              <a href="mailto:deal@v3partners.com.br" style="color:#C9A84C; text-decoration:none;">deal@v3partners.com.br</a>
              &nbsp;·&nbsp;
              <a href="https://v3partners.com.br" style="color:#C9A84C; text-decoration:none;">v3partners.com.br</a>
            </p>
          </td>
        </tr>

      </table>
      <!-- /Container principal -->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as ForjaNotifyPayload;
  const { deal_id, score, recommendation, missing, corrected, doc_insights, upload_token } = body;

  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ ok: true, mode: "demo" });

  // Busca dados do deal (colunas reais da tabela ma_deals)
  const { data: deal } = await svc()
    .from("ma_deals")
    .select("id, code, v3_code, target_company, sector, deal_value, asset_data, assigned_to, created_by")
    .eq("id", deal_id)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // Busca usuário responsável (assigned_to) para incluir no email
  let partnerInfo: { full_name?: string; email?: string } | null = null;
  const responsavelId = (deal.assigned_to ?? deal.created_by) as string | null;
  if (responsavelId) {
    const { data: responsavel } = await svc()
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", responsavelId)
      .single();
    partnerInfo = responsavel;
  }

  const dealCodigo = (deal.v3_code ?? deal.code ?? deal_id.slice(0, 8)).toString();
  const dealNome   = (deal.target_company ?? "Deal").toString();
  const assetData  = (deal.asset_data ?? {}) as Record<string, unknown>;

  // Monta listas de pendências legíveis
  const pendencias = (missing ?? []).slice(0, 8).map(m => {
    const campo = m.field.replace(/_/g, " ").toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
    return `${campo} — ${m.impact}`;
  });

  const insights = (doc_insights ?? []).map(i => `${i.doc}: ${i.finding}`);

  const portalUrl  = "https://app.v3partners.com.br/mesa-ma";
  const uploadUrl  = upload_token
    ? `https://app.v3partners.com.br/upload/${upload_token}`
    : undefined;

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);

  const sends: Promise<unknown>[] = [];

  // 1. Email para a Mesa (João + Responsável)
  const mesaDestinatarios = [
    "joao.lemos@v3partners.com.br",
    "deal@v3partners.com.br",
  ];
  // Adiciona email do responsável se diferente dos fixos
  if (partnerInfo?.email &&
      partnerInfo.email !== "joao.lemos@v3partners.com.br" &&
      partnerInfo.email !== "deal@v3partners.com.br") {
    mesaDestinatarios.push(partnerInfo.email);
  }

  sends.push(
    resend.emails.send({
      from:    "V3 Partners Mesa M&A <noreply@v3partners.com.br>",
      replyTo: "deal@v3partners.com.br",
      to:      mesaDestinatarios,
      subject: `[FORJA] ${dealCodigo} · ${recLabel(recommendation)} · Score ${score}/100`,
      html: buildForjaEmail({
        destinatarioNome: "Mesa",
        dealCodigo,
        score,
        recommendation,
        pendencias,
        docInsights: insights,
        portalUrl,
        uploadUrl,
        tipo: "mesa",
      }),
    })
  );

  // 2. Email para o Partner (se existir e tiver email)
  if (partnerInfo?.email) {
    sends.push(
      resend.emails.send({
        from:    "V3 Partners <noreply@v3partners.com.br>",
        replyTo: "deal@v3partners.com.br",
        to:      partnerInfo.email,
        subject: `Pendências para avançar no deal ${dealCodigo}`,
        html: buildForjaEmail({
          destinatarioNome: partnerInfo.full_name ?? "Partner",
          dealCodigo,
          score,
          recommendation,
          pendencias,
          docInsights: [],
          portalUrl,
          uploadUrl,
          tipo: "partner",
        }),
      })
    );
  }

  // 3. Email para o cliente (se houver contato no asset_data)
  const emailCliente = (assetData.email_contato ?? assetData.email_cliente) as string | undefined;
  const nomeCliente  = (assetData.nome_contato ?? dealNome) as string;
  if (emailCliente) {
    sends.push(
      resend.emails.send({
        from:    "V3 Partners <noreply@v3partners.com.br>",
        replyTo: "deal@v3partners.com.br",
        to:      emailCliente,
        subject: `Documentação necessária para análise — V3 Partners`,
        html: buildForjaEmail({
          destinatarioNome: nomeCliente,
          dealCodigo,
          score,
          recommendation,
          pendencias,
          docInsights: [],
          portalUrl,
          uploadUrl,
          tipo: "cliente",
        }),
      })
    );
  }

  try {
    const results = await Promise.allSettled(sends);
    const errors  = results.filter(r => r.status === "rejected");
    if (errors.length > 0) {
      console.error("[forja-notify] Erros parciais:", errors);
    }
    return NextResponse.json({
      ok:        true,
      enviados:  sends.length,
      erros:     errors.length,
      deal_code: dealCodigo,
    });
  } catch (err) {
    console.error("[forja-notify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar emails" },
      { status: 500 }
    );
  }
}

function recLabel(r: string): string {
  switch (r) {
    case "APROVADO":               return "Aprovado";
    case "APROVADO_COM_RESSALVAS": return "Aprovado c/ ressalvas";
    case "PENDENTE":               return "Pendente";
    default:                       return "Bloqueado";
  }
}

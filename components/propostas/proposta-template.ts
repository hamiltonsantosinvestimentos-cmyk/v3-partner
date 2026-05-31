// Template HTML A4 para propostas comerciais V3 Partners
// Usado pelo endpoint /api/propostas/[id]/send para gerar o documento ClickSign

export type PropostaTemplateData = {
  code: string;
  title: string;
  service_type: string;
  recipient_name: string;
  recipient_email: string;
  recipient_company?: string;
  value?: number;
  description?: string;
  sender_name: string;
  date: string;
};

const SERVICE_LABELS: Record<string, string> = {
  due_diligence:    "Due Diligence Avançada",
  relatorio_premium:"Relatório Premium",
  consultoria:      "Consultoria Especializada",
  outro:            "Serviço Personalizado",
};

function fmtBRL(v?: number): string {
  if (!v) return "A definir";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export function buildPropostaHTML(data: PropostaTemplateData): string {
  const serviceLabel = SERVICE_LABELS[data.service_type] ?? data.service_type;
  const today = new Date(data.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const expiry = new Date(new Date(data.date).getTime() + 30 * 24 * 3600 * 1000)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Proposta Comercial — ${data.code}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@1,600&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #09081A;
    color: #F5F1E8;
    font-family: 'DM Sans', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: A4; margin: 18mm 16mm; }
  .page {
    max-width: 794px;
    margin: 0 auto;
    padding: 48px 48px 40px;
    background: #09081A;
    min-height: 1123px;
    position: relative;
  }
  /* ── Stripe dourada ── */
  .stripe {
    height: 3px;
    background: linear-gradient(90deg, #09081A 0%, #C9A84C 20%, #E8C97A 50%, #C9A84C 80%, #09081A 100%);
    margin-bottom: 32px;
  }
  /* ── Header ── */
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
  .header img { height: 40px; }
  .header-meta { text-align: right; }
  .header-meta .code { font-size: 9px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #E8C97A; }
  .header-meta .date { font-size: 11px; color: #9BAFC5; margin-top: 3px; }
  /* ── Título ── */
  .title-block { margin-bottom: 36px; padding-bottom: 28px; border-bottom: 1px solid #162744; }
  .eyebrow { font-size: 9px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #E8C97A; margin-bottom: 10px; }
  .title { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 600; font-size: 36px; color: #F5F1E8; line-height: 1.2; }
  .subtitle { font-size: 13px; color: #9BAFC5; margin-top: 8px; }
  /* ── Grid de info ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
  .info-card { background: #162744; border: 1px solid #243A66; border-radius: 6px; padding: 14px 16px; }
  .info-card .label { font-size: 8px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #E8C97A; margin-bottom: 4px; }
  .info-card .value { font-size: 13px; color: #F5F1E8; font-weight: 600; }
  .info-card .value.gold { color: #C9A84C; font-size: 20px; font-weight: 800; }
  /* ── Destinatário ── */
  .recipient-block { background: #13223A; border: 1px solid #243A66; border-radius: 8px; padding: 20px 22px; margin-bottom: 28px; }
  .recipient-block .label { font-size: 8px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #E8C97A; margin-bottom: 10px; }
  .recipient-block .name { font-size: 16px; font-weight: 700; color: #F5F1E8; }
  .recipient-block .company { font-size: 12px; color: #9BAFC5; margin-top: 2px; }
  .recipient-block .email { font-size: 11px; color: #9BAFC5; margin-top: 4px; }
  /* ── Escopo ── */
  .scope-block { margin-bottom: 28px; }
  .scope-block .label { font-size: 9px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #E8C97A; margin-bottom: 10px; }
  .scope-block .body { font-size: 13px; color: #9BAFC5; line-height: 1.8; white-space: pre-wrap; background: #162744; border: 1px solid #243A66; border-radius: 6px; padding: 16px 18px; }
  /* ── Highlight de validade ── */
  .validity { background: rgba(201,168,76,.06); border-left: 3px solid #C9A84C; border-radius: 0 6px 6px 0; padding: 12px 16px; margin-bottom: 32px; font-size: 12px; color: #9BAFC5; }
  .validity strong { color: #F5F1E8; }
  /* ── Assinatura ── */
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 28px; border-top: 1px solid #162744; }
  .sig-line { border-top: 1px solid #243A66; padding-top: 8px; margin-top: 40px; }
  .sig-line .name { font-size: 12px; font-weight: 700; color: #F5F1E8; }
  .sig-line .role { font-size: 10px; color: #9BAFC5; }
  /* ── Footer ── */
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #162744; display: flex; justify-content: space-between; align-items: center; }
  .footer .logo-sm { height: 24px; opacity: .45; }
  .footer .legal { font-size: 9px; color: #243A66; text-align: right; line-height: 1.6; }
  @media print {
    html, body, .page { background: #09081A !important; }
    .page { padding: 0; min-height: auto; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="stripe"></div>

  <!-- Header -->
  <div class="header">
    <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners"/>
    <div class="header-meta">
      <div class="code">${data.code}</div>
      <div class="date">${today}</div>
    </div>
  </div>

  <!-- Título -->
  <div class="title-block">
    <div class="eyebrow">Proposta Comercial · ${serviceLabel}</div>
    <div class="title">${data.title}</div>
    <div class="subtitle">Preparada por <strong style="color:#F5F1E8">${data.sender_name}</strong> · V3 Partners Soluções Ltda</div>
  </div>

  <!-- Grid info -->
  <div class="info-grid">
    <div class="info-card">
      <div class="label">Serviço</div>
      <div class="value">${serviceLabel}</div>
    </div>
    <div class="info-card">
      <div class="label">Valor da Proposta</div>
      <div class="value gold">${fmtBRL(data.value)}</div>
    </div>
  </div>

  <!-- Destinatário -->
  <div class="recipient-block">
    <div class="label">Apresentada a</div>
    <div class="name">${data.recipient_name}</div>
    ${data.recipient_company ? `<div class="company">${data.recipient_company}</div>` : ""}
    <div class="email">${data.recipient_email}</div>
  </div>

  <!-- Escopo -->
  ${data.description ? `
  <div class="scope-block">
    <div class="label">Escopo e Entregáveis</div>
    <div class="body">${data.description}</div>
  </div>` : ""}

  <!-- Validade -->
  <div class="validity">
    <strong>Validade desta proposta:</strong> até ${expiry}.<br/>
    Após esta data, os valores e condições aqui apresentados poderão ser revisados.
  </div>

  <!-- Assinaturas -->
  <div class="sig-block">
    <div>
      <div class="sig-line">
        <div class="name">${data.sender_name}</div>
        <div class="role">V3 Partners Soluções Ltda · Mesa M&amp;A</div>
      </div>
    </div>
    <div>
      <div class="sig-line">
        <div class="name">${data.recipient_name}</div>
        <div class="role">${data.recipient_company ?? "Contratante"}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <img class="logo-sm" src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners"/>
    <div class="legal">
      V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br/>
      Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro · contato@v3partners.com.br
    </div>
  </div>
</div>
</body>
</html>`;
}

type TecEmailData = {
  fund_name: string;
  deal_code: string;
  tec_percentage: number;
  fee_value: string;
  deal_value: string;
  recipient_name: string;
  recipient_email?: string;
  acceptance_url?: string;
  meeting_link?: string;
  meeting_date_formatted?: string;
  accepted_date?: string;
};

const HEADER = (title: string) => `
<div style="background:#09081A;padding:40px 32px;font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto">
  <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:36px;margin-bottom:28px"/>
  <p style="font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#E8C97A;margin:0 0 8px">${title}</p>`;

const FOOTER = `
  <hr style="border:none;border-top:1px solid #162744;margin:24px 0"/>
  <p style="font-size:11px;color:#9BAFC5;margin:0 0 4px;line-height:1.6">
    V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
  <p style="font-size:11px;color:#9BAFC5;margin:0 0 4px;line-height:1.6">
    Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro</p>
  <p style="font-size:11px;line-height:1.6">
    <a href="mailto:contato@v3partners.com.br" style="color:#9BAFC5">contato@v3partners.com.br</a>
    <span style="color:#243A66"> · </span>
    <a href="https://v3partners.com.br" style="color:#9BAFC5">v3partners.com.br</a></p>
</div>`;

const CTA = (href: string, label: string) => `
  <div style="margin:24px 0;text-align:center">
    <a href="${href}" style="display:inline-block;background:#C9A84C;color:#09081A;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:700;font-family:'DM Sans',Arial,sans-serif">${label}</a>
  </div>`;

const CARD = (content: string) => `
  <div style="background:#13223A;border:1px solid #243A66;border-radius:8px;padding:20px 24px;margin:20px 0">
    ${content}
  </div>`;

const FIELD = (label: string, value: string, large = false) => `
  <div style="margin-bottom:12px">
    <p style="margin:0 0 2px;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E8C97A">${label}</p>
    <p style="margin:0;font-size:${large ? "28px;font-weight:800;color:#C9A84C" : "15px;font-weight:600;color:#F5F1E8"}">${value}</p>
  </div>`;

export function buildTecEmail1(d: TecEmailData): string {
  return `${HEADER("Mandato — Taxa de Estruturação de Crédito")}
  <h1 style="font-size:22px;font-weight:700;color:#F5F1E8;margin:0 0 16px;line-height:1.3">Aprovação de Operação — ${d.fund_name}</h1>
  <hr style="border:none;border-top:1px solid #243A66;margin:0 0 20px"/>
  <p style="font-size:14px;color:#9BAFC5;line-height:1.7;margin:0 0 16px">
    Prezado(a) <strong style="color:#F5F1E8">${d.recipient_name}</strong>,</p>
  <p style="font-size:14px;color:#9BAFC5;line-height:1.7;margin:0 0 20px">
    A V3 Partners tem a satisfação de informar que sua operação vinculada ao deal
    <strong style="color:#F5F1E8">${d.deal_code}</strong> foi aprovada pela nossa mesa de estruturação.
    Para formalizar o processo, apresentamos abaixo as condições da
    <strong style="color:#C9A84C">Taxa de Estruturação de Crédito (TEC)</strong>.</p>
  ${CARD(`
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#E8C97A">Condições do Mandato</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" valign="top" style="padding:0 8px 0 0">${FIELD("Fundo", d.fund_name)}${FIELD("Taxa TEC", `${d.tec_percentage}%`, true)}</td>
      <td width="50%" valign="top" style="padding:0 0 0 8px">${FIELD("Deal", d.deal_code)}${FIELD("Fee Estimado", d.fee_value)}</td>
    </tr></table>
    <hr style="border:none;border-top:1px solid #243A66;margin:8px 0 12px"/>
    ${FIELD("Valor da Operação", d.deal_value)}
  `)}
  <div style="background:#162744;border:1px solid #243A66;border-radius:8px;padding:18px 22px;margin:20px 0">
    <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#E8C97A">Termos e Condições</p>
    <p style="font-size:13px;color:#9BAFC5;line-height:1.7;margin:0 0 10px">
      <strong style="color:#F5F1E8">Multa contratual:</strong> Em caso de desistência unilateral após o aceite formal, incidirá multa de
      <strong style="color:#C9A84C">2% (dois por cento)</strong> sobre o valor total da operação.</p>
    <p style="font-size:13px;color:#9BAFC5;line-height:1.7;margin:0">
      <strong style="color:#F5F1E8">Negativação:</strong> Na hipótese de inadimplência superior a
      <strong style="color:#C9A84C">30 (trinta) dias corridos</strong>, a V3 Partners reserva-se o direito de inscrever o devedor nos cadastros restritivos de crédito (SPC, Serasa).</p>
  </div>
  ${CTA(d.acceptance_url ?? "#", "Aceitar Mandato TEC")}
  <p style="font-size:12px;color:#9BAFC5;line-height:1.6;text-align:center;margin:0 0 24px">
    Este mandato expira em <strong style="color:#F5F1E8">7 dias</strong> a partir do envio.</p>
  ${FOOTER}`;
}

export function buildTecEmail2(d: TecEmailData): string {
  const meetingBlock = d.meeting_link && d.meeting_date_formatted
    ? `<div style="background:#162744;border:1px solid #C9A84C;border-radius:8px;padding:22px;margin:20px 0">
        <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#E8C97A">Reunião Agendada</p>
        <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F5F1E8">${d.meeting_date_formatted}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#9BAFC5;line-height:1.6">Utilize o botão abaixo para acessar a sala no horário agendado.</p>
        ${CTA(d.meeting_link, "Entrar na Reunião")}
      </div>`
    : `<p style="font-size:14px;color:#9BAFC5;line-height:1.7;margin:20px 0">A equipe V3 Partners entrará em contato para agendar os próximos passos.</p>`;

  return `${HEADER("Mandato Aceito")}
  <div style="display:inline-block;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:20px;padding:4px 12px;margin-bottom:16px">
    <span style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#4ade80">Mandato Aceito</span>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#F5F1E8;margin:0 0 16px;line-height:1.3">Próximos Passos — ${d.fund_name}</h1>
  <hr style="border:none;border-top:1px solid #243A66;margin:0 0 20px"/>
  <p style="font-size:14px;color:#9BAFC5;line-height:1.7;margin:0 0 16px">
    Prezado(a) <strong style="color:#F5F1E8">${d.recipient_name}</strong>,</p>
  <p style="font-size:14px;color:#9BAFC5;line-height:1.7;margin:0 0 20px">
    Confirmamos o recebimento do seu aceite ao Mandato TEC referente ao deal
    <strong style="color:#F5F1E8">${d.deal_code}</strong>, registrado em
    <strong style="color:#F5F1E8">${d.accepted_date ?? new Date().toLocaleDateString("pt-BR")}</strong>.</p>
  ${CARD(`
    <p style="margin:0 0 12px;font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#E8C97A">Resumo da Operação</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" valign="top">${FIELD("Fundo", d.fund_name)}${FIELD("Valor", d.deal_value)}</td>
      <td width="50%" valign="top">${FIELD("Taxa TEC", `${d.tec_percentage}%`)}${FIELD("Fee", d.fee_value)}</td>
    </tr></table>
  `)}
  ${meetingBlock}
  ${FOOTER}`;
}

export function buildTecEmail3(d: TecEmailData): string {
  return `${HEADER("Lembrete")}
  <div style="display:inline-block;background:rgba(232,155,58,.12);border:1px solid rgba(232,155,58,.25);border-radius:20px;padding:4px 12px;margin-bottom:16px">
    <span style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#E89B3A">Lembrete</span>
  </div>
  <h1 style="font-size:24px;font-weight:800;color:#F5F1E8;margin:0 0 8px;line-height:1.2">Sua reunião começa em 30 minutos</h1>
  <p style="font-size:14px;color:#9BAFC5;margin:0 0 20px">${d.fund_name} · ${d.deal_code}</p>
  <div style="background:#13223A;border:1px solid #C9A84C;border-radius:10px;padding:28px;text-align:center;margin:0 0 20px">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#E8C97A">Data e Horário</p>
    <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#F5F1E8">${d.meeting_date_formatted ?? ""}</p>
    ${CTA(d.meeting_link ?? "#", "Entrar na Reunião Agora")}
  </div>
  <div style="background:#162744;border:1px solid #243A66;border-radius:8px;padding:14px 18px;margin:0 0 20px">
    <p style="margin:0 0 8px;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E8C97A">Participantes</p>
    <p style="margin:0 0 4px;font-size:13px;color:#F5F1E8">${d.recipient_name} <span style="color:#9BAFC5">· ${d.recipient_email ?? ""}</span></p>
    <p style="margin:0;font-size:13px;color:#F5F1E8">Equipe V3 Partners <span style="color:#9BAFC5">· contato@v3partners.com.br</span></p>
  </div>
  <p style="font-size:12px;color:#9BAFC5;line-height:1.6;text-align:center;margin:0 0 24px">
    Se precisar reagendar, entre em contato pelo email
    <a href="mailto:contato@v3partners.com.br" style="color:#C9A84C">contato@v3partners.com.br</a>
    ou WhatsApp <a href="https://wa.me/5511937639475" style="color:#C9A84C">+55 11 93763-9475</a>.</p>
  ${FOOTER}`;
}

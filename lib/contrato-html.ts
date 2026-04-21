// Gera o certificado HTML de assinatura do Contrato de Mandato
// Salvo no Supabase Storage e enviado por e-mail a todos os envolvidos

interface AssinanteInfo {
  papel: string;
  nome: string;
  email: string;
  cpf?: string | null;
  ip?: string | null;
  data?: string | null;
}

interface ContratoCompleto {
  proposal_code: string | null;
  client_name: string;
  client_email: string;
  client_cpf: string | null;
  credit_line: string | null;
  deal_value: number | null;
  commission_perc: number;
  signed_at: string | null;
  ip_address: string | null;
  v3_signer_name: string | null;
  v3_email: string | null;
  v3_signed_at: string | null;
  v3_ip_address: string | null;
  testemunha_nome: string | null;
  testemunha_email: string | null;
  testemunha_cpf: string | null;
  testemunha_signed_at: string | null;
  testemunha_ip_address: string | null;
  testemunha2_nome: string | null;
  testemunha2_email: string | null;
  testemunha2_cpf: string | null;
  testemunha2_signed_at: string | null;
  testemunha2_ip_address: string | null;
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function moeda(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function bloco(a: AssinanteInfo): string {
  return `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #1B3050;vertical-align:top;">
        <span style="display:inline-block;font-size:10px;font-weight:700;color:#C9A84C;
          text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${a.papel}</span><br>
        <strong style="color:#F0ECE4;font-size:14px;">${a.nome || "—"}</strong><br>
        <span style="color:#7A8FA8;font-size:12px;">${a.email || "—"}</span>
        ${a.cpf ? `<br><span style="color:#7A8FA8;font-size:12px;">CPF/CNPJ: ${a.cpf}</span>` : ""}
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #1B3050;vertical-align:top;">
        <span style="color:#7A8FA8;font-size:11px;">Data e hora</span><br>
        <strong style="color:#F0ECE4;font-size:13px;">${fmtData(a.data)}</strong>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #1B3050;vertical-align:top;">
        <span style="color:#7A8FA8;font-size:11px;">IP de origem</span><br>
        <strong style="color:#F0ECE4;font-size:13px;font-family:monospace;">${a.ip || "—"}</strong>
      </td>
    </tr>`;
}

export function gerarCertificadoHTML(c: ContratoCompleto): string {
  const assinantes: AssinanteInfo[] = [
    {
      papel: "Contratante (Cliente)",
      nome: c.client_name,
      email: c.client_email,
      cpf: c.client_cpf,
      ip: c.ip_address,
      data: c.signed_at,
    },
    {
      papel: "Contratada — V3 Partners",
      nome: c.v3_signer_name ?? "V3 Partners Soluções Ltda",
      email: c.v3_email ?? "joao.lemos@v3partners.com.br",
      cpf: null,
      ip: c.v3_ip_address,
      data: c.v3_signed_at,
    },
    {
      papel: "1ª Testemunha (Parceiro Originador)",
      nome: c.testemunha_nome ?? "—",
      email: c.testemunha_email ?? "—",
      cpf: c.testemunha_cpf,
      ip: c.testemunha_ip_address,
      data: c.testemunha_signed_at,
    },
    {
      papel: "2ª Testemunha (Testemunha Institucional)",
      nome: c.testemunha2_nome ?? "Aline Rodrigues dos Santos",
      email: c.testemunha2_email ?? "financeiro@v3partners.com.br",
      cpf: c.testemunha2_cpf,
      ip: c.testemunha2_ip_address,
      data: c.testemunha2_signed_at,
    },
  ];

  const geradoEm = fmtData(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Certificado de Assinatura — ${c.proposal_code ?? ""}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
    body { margin:0; padding:0; background:#09081A; font-family:'DM Sans',sans-serif; color:#F0ECE4; }
    table { border-collapse:collapse; }
    a { color:#C9A84C; }
  </style>
</head>
<body style="background:#09081A;padding:40px 20px;">
  <div style="max-width:720px;margin:0 auto;">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:12px;
        background:linear-gradient(135deg,#C9A84C,#E8C97A);
        display:flex;align-items:center;justify-content:center;
        font-size:18px;font-weight:900;color:#09081A;flex-shrink:0;">V3</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:#F0ECE4;">V3 PARTNERS SOLUÇÕES LTDA</div>
        <div style="font-size:11px;color:#7A8FA8;">CNPJ 14.219.287/0001-50 · v3partners.com.br</div>
      </div>
      <div style="margin-left:auto;text-align:right;">
        <div style="font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:1px;">Proposta</div>
        <div style="font-size:14px;font-weight:700;color:#C9A84C;">${c.proposal_code ?? "—"}</div>
      </div>
    </div>

    <!-- Título -->
    <div style="background:#0C1929;border:1px solid #1B3050;border-radius:16px;
      padding:28px;text-align:center;margin-bottom:24px;">
      <div style="font-size:10px;font-weight:700;color:#C9A84C;text-transform:uppercase;
        letter-spacing:2px;margin-bottom:8px;">✅ CONTRATO TOTALMENTE ASSINADO</div>
      <div style="font-size:22px;font-weight:800;color:#F0ECE4;margin-bottom:4px;">
        Certificado de Assinatura Eletrônica
      </div>
      <div style="font-size:13px;color:#7A8FA8;">
        Instrumento Particular de Mandato de Representação
      </div>
    </div>

    <!-- Resumo do negócio -->
    <div style="background:#0C1929;border:1px solid #1B3050;border-radius:16px;
      padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:10px;font-weight:700;color:#C9A84C;text-transform:uppercase;
        letter-spacing:1px;margin-bottom:14px;">Dados da Operação</div>
      <table width="100%">
        <tr>
          <td style="padding:6px 0;color:#7A8FA8;font-size:12px;width:40%;">Cliente / Contratante</td>
          <td style="padding:6px 0;color:#F0ECE4;font-size:13px;font-weight:600;">${c.client_name}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#7A8FA8;font-size:12px;">CPF / CNPJ</td>
          <td style="padding:6px 0;color:#F0ECE4;font-size:13px;">${c.client_cpf ?? "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#7A8FA8;font-size:12px;">Linha de Crédito</td>
          <td style="padding:6px 0;color:#F0ECE4;font-size:13px;">${c.credit_line ?? "—"}</td>
        </tr>
        ${c.deal_value ? `<tr>
          <td style="padding:6px 0;color:#7A8FA8;font-size:12px;">Valor da Operação</td>
          <td style="padding:6px 0;color:#C9A84C;font-size:14px;font-weight:700;">${moeda(c.deal_value)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:6px 0;color:#7A8FA8;font-size:12px;">Remuneração de Sucesso</td>
          <td style="padding:6px 0;color:#F0ECE4;font-size:13px;">${c.commission_perc}%</td>
        </tr>
      </table>
    </div>

    <!-- Assinaturas -->
    <div style="background:#0C1929;border:1px solid #1B3050;border-radius:16px;
      overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px 20px;border-bottom:1px solid #1B3050;">
        <div style="font-size:10px;font-weight:700;color:#C9A84C;text-transform:uppercase;
          letter-spacing:1px;">Registro de Assinaturas Eletrônicas</div>
      </div>
      <table width="100%">
        <thead>
          <tr style="background:#07101E;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;color:#7A8FA8;
              font-weight:600;text-transform:uppercase;letter-spacing:1px;">Parte / Papel</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;color:#7A8FA8;
              font-weight:600;text-transform:uppercase;letter-spacing:1px;">Data e Hora (BRT)</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;color:#7A8FA8;
              font-weight:600;text-transform:uppercase;letter-spacing:1px;">IP de Origem</th>
          </tr>
        </thead>
        <tbody>
          ${assinantes.map(bloco).join("")}
        </tbody>
      </table>
    </div>

    <!-- Validade jurídica -->
    <div style="background:#0A1A30;border:1px solid #1B3050;border-left:3px solid #C9A84C;
      border-radius:8px;padding:16px 20px;margin-bottom:32px;">
      <div style="font-size:11px;color:#7A8FA8;line-height:1.8;">
        Este certificado comprova a assinatura eletrônica do instrumento acima nos termos da
        <strong style="color:#F0ECE4;">MP 2.200-2/2001</strong> e da
        <strong style="color:#F0ECE4;">Lei 14.063/2020</strong>.
        As assinaturas foram registradas com data, hora e endereço IP de cada signatário,
        constituindo prova eletrônica com plena validade jurídica.
      </div>
    </div>

    <!-- Rodapé -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid #1B3050;">
      <div style="font-size:11px;color:#7A8FA8;">
        Certificado gerado em ${geradoEm} (Horário de Brasília)<br>
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br>
        Rua Visconde de Pirajá, 414/Sala 718 – Ipanema – Rio de Janeiro – RJ · CEP 22.410-002
      </div>
    </div>

  </div>
</body>
</html>`;
}

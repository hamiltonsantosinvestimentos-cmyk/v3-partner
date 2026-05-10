import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>";

// Envia e-mail — nunca bloqueia a operação principal
// Resend é instanciado em runtime (não em build time) para evitar erro de chave ausente
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch { /* silent */ }
}

// ── Template base ──────────────────────────────────────────────────────────
function template(title: string, body: string, cta?: { label: string; url: string }): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#07101E;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0C1929;border-radius:12px;overflow:hidden;border:1px solid #1B3050;">

    <div style="padding:24px 32px;border-bottom:1px solid #1B3050;background:#07101E;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:3px;height:24px;background:linear-gradient(180deg,#C4922E,#E5B96A);border-radius:2px;"></div>
        <span style="font-size:16px;font-weight:800;color:#E5B96A;letter-spacing:0.08em;">V3 PARTNERS</span>
      </div>
    </div>

    <div style="padding:32px;">
      <h2 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#C8D4E3;line-height:1.3;">${title}</h2>
      ${body}
      ${cta ? `
      <div style="margin-top:28px;">
        <a href="${cta.url}"
          style="display:inline-block;background:#C4922E;color:#07101E;text-decoration:none;
                 padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
          ${cta.label} →
        </a>
      </div>` : ""}
    </div>

    <div style="padding:18px 32px;border-top:1px solid #1B3050;background:#07101E;">
      <p style="margin:0;font-size:11px;color:#7A96AF;">
        V3 Partners — Plataforma Financeira &nbsp;·&nbsp; E-mail automático, não responda.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;
                       padding:9px 0;border-bottom:1px solid #1B3050;">
    <span style="font-size:13px;color:#7A96AF;">${label}</span>
    <span style="font-size:13px;font-weight:600;color:#C8D4E3;">${value}</span>
  </div>`;
}

function highlight(label: string, value: string, color: string): string {
  return `<div style="margin-top:16px;padding:14px 18px;background:#13243D;
                       border-radius:8px;border-left:3px solid ${color};">
    <p style="margin:0 0 4px;font-size:11px;color:#7A96AF;">${label}</p>
    <p style="margin:0;font-size:22px;font-weight:800;color:${color};">${value}</p>
  </div>`;
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Partner: confirmação de assinatura do contrato de parceria */
export async function notifyContratoParceriaAssinado(opts: {
  partnerEmail: string;
  partnerName: string;
  plano: string;
  valorMensal: string;
  dataAssinatura: string;
}): Promise<void> {
  const planoLabel = opts.plano === "PARTNER_PRO" ? "Partner PRO" : "Partner";
  const body = `
    <p style="color:#C8D4E3;font-size:14px;margin-bottom:20px;">
      Olá, <strong>${opts.partnerName}</strong>!<br><br>
      Seu contrato de parceria com a V3 Partners foi assinado com sucesso.
      Bem-vindo ao ecossistema V3!
    </p>
    ${row("Plano contratado", planoLabel)}
    ${row("Mensalidade", opts.valorMensal)}
    ${row("Data da assinatura", opts.dataAssinatura)}
    ${row("Validade", "12 meses")}
    <div style="margin-top:20px;padding:14px 18px;background:#0A2018;border-radius:8px;border-left:3px solid #10B981;">
      <p style="margin:0;font-size:13px;color:#10B981;font-weight:600;">
        ✅ Contrato registrado eletronicamente conforme Lei nº 14.063/2020
      </p>
    </div>
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Você já pode acessar a plataforma e começar a operar. Em caso de dúvidas, entre em contato com nossa equipe.
    </p>
  `;
  await send(
    opts.partnerEmail,
    `✅ Contrato V3 ${planoLabel} assinado com sucesso`,
    template(`Bem-vindo à V3, ${opts.partnerName}!`, body, {
      label: "Acessar Plataforma",
      url: "https://v3-partner.vercel.app/dashboard",
    })
  );
}

const dataLocal = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR");

// ── Notificações exportadas ────────────────────────────────────────────────

/** Admin/Mesa: nova proposta enviada por um partner */
export async function notifyNovaProposta(opts: {
  adminEmail: string;
  partnerName: string;
  proposalCode: string;
  proposalTitle: string;
  clientName: string;
  creditLine: string;
  requestedValue: number;
}) {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Uma nova proposta foi enviada e aguarda análise.
    </p>
    ${row("Parceiro", opts.partnerName)}
    ${row("Código", opts.proposalCode)}
    ${row("Título", opts.proposalTitle)}
    ${row("Cliente", opts.clientName)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${highlight("Valor Solicitado", moeda(opts.requestedValue), "#C4922E")}
  `;
  await send(
    opts.adminEmail,
    `📋 Nova proposta recebida — ${opts.proposalCode}`,
    template("Nova Proposta na Mesa de Crédito", body, {
      label: "Ver na Mesa de Crédito",
      url: "https://v3-partner.vercel.app/mesa-credito",
    })
  );
}

/** Partner: status da proposta atualizado */
export async function notifyPropostaAtualizada(opts: {
  partnerEmail: string;
  partnerName: string;
  proposalCode: string;
  proposalTitle: string;
  creditLine: string;
  novoStatus: string;
}) {
  const statusMap: Record<string, { label: string; color: string; emoji: string }> = {
    IN_REVIEW:  { label: "Em Análise",  color: "#F59E0B", emoji: "🔍" },
    APPROVED:   { label: "Aprovado",    color: "#10B981", emoji: "✅" },
    REJECTED:   { label: "Reprovado",   color: "#EF4444", emoji: "❌" },
    COMPLETED:  { label: "Concluído",   color: "#10B981", emoji: "🎉" },
    CANCELLED:  { label: "Cancelado",   color: "#7A96AF", emoji: "⚠️" },
  };
  const st = statusMap[opts.novoStatus];
  if (!st) return; // não notifica PENDING ou outros estados internos

  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.partnerName}</strong>!
      O status da sua proposta foi atualizado.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Título", opts.proposalTitle)}
    ${row("Linha de Crédito", opts.creditLine)}
    <div style="margin-top:16px;padding:14px 18px;background:#13243D;
                border-radius:8px;border-left:3px solid ${st.color};">
      <p style="margin:0 0 4px;font-size:11px;color:#7A96AF;">Novo status</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:${st.color};">
        ${st.emoji} ${st.label}
      </p>
    </div>
  `;
  await send(
    opts.partnerEmail,
    `${st.emoji} Proposta ${opts.proposalCode} — ${st.label}`,
    template("Atualização da sua Proposta", body, {
      label: "Ver Proposta",
      url: "https://v3-partner.vercel.app/mesa-credito",
    })
  );
}

/** Partner: nova comissão registrada */
export async function notifyNovaComissao(opts: {
  partnerEmail: string;
  partnerName: string;
  commissionCode: string;
  operationDescription: string;
  operationType: string;
  commissionValue: number;
  paymentDate?: string | null;
}) {
  const tipoLabels: Record<string, string> = {
    CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split Fiscal",
  };
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.partnerName}</strong>!
      Uma nova comissão foi registrada para você.
    </p>
    ${row("Código", opts.commissionCode)}
    ${row("Operação", opts.operationDescription)}
    ${row("Tipo", tipoLabels[opts.operationType] ?? opts.operationType)}
    ${opts.paymentDate ? row("Previsão de Pagamento", dataLocal(opts.paymentDate)) : ""}
    ${highlight("Valor a Receber", moeda(opts.commissionValue), "#C4922E")}
  `;
  await send(
    opts.partnerEmail,
    `💰 Nova comissão a receber — ${moeda(opts.commissionValue)}`,
    template("Nova Comissão Registrada", body, {
      label: "Ver Comissões",
      url: "https://v3-partner.vercel.app/comissoes",
    })
  );
}

/** Cliente: contrato enviado para assinatura via token */
export async function notifyContratoCliente(opts: {
  clientEmail: string;
  clientName: string;
  proposalCode: string;
  creditLine: string;
  requestedValue: number;
  signingUrl: string;
  expiresAt: string;
}) {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.clientName}</strong>!
      Sua proposta de crédito está pronta para assinatura do Mandato de Representação.
    </p>
    ${row("Código da Proposta", opts.proposalCode)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${highlight("Valor Solicitado", moeda(opts.requestedValue), "#C4922E")}
    <p style="color:#7A96AF;font-size:13px;margin-top:20px;">
      Clique no botão abaixo para ler e assinar o contrato digitalmente.
      O link expira em <strong style="color:#E5B96A;">${new Date(opts.expiresAt).toLocaleDateString("pt-BR")}</strong>.
    </p>
    <p style="color:#7A96AF;font-size:12px;margin-top:8px;">
      Após a assinatura, nossa equipe dará continuidade à análise da sua operação.
    </p>
  `;
  await send(
    opts.clientEmail,
    `📋 Assine seu contrato — V3 Partners · ${opts.proposalCode}`,
    template("Contrato Pronto para Assinatura", body, {
      label: "Assinar Contrato",
      url: opts.signingUrl,
    })
  );
}

/** V3 Rep: contrato enviado para assinatura */
export async function notifyContratoV3Rep(opts: {
  repEmail: string;
  clientName: string;
  clientEmail: string;
  proposalCode: string;
  creditLine: string;
  requestedValue: number;
  commissionPerc: number;
  signingUrl: string;
}) {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Contrato de mandato enviado ao cliente para assinatura eletrônica.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Cliente", opts.clientName)}
    ${row("E-mail do Cliente", opts.clientEmail)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${row("Comissão V3", `${opts.commissionPerc}%`)}
    ${highlight("Valor da Operação", moeda(opts.requestedValue), "#C4922E")}
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Acompanhe o status de assinatura na Mesa Operacional.
    </p>
  `;
  await send(
    opts.repEmail,
    `📤 Contrato enviado — ${opts.clientName} · ${opts.proposalCode}`,
    template("Mandato Enviado para Assinatura", body, {
      label: "Ver na Mesa Operacional",
      url: "https://v3-partner.vercel.app/mesa-operacional",
    })
  );
}

/** Cliente: confirmação de assinatura + aviso que aguarda V3 */
export async function notifyContratoAssinado(opts: {
  clientEmail: string;
  clientName: string;
  proposalCode: string;
  creditLine: string;
  signedAt: string;
}) {
  const dateStr = new Date(opts.signedAt).toLocaleString("pt-BR");
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.clientName}</strong>!
      Sua assinatura foi registrada com sucesso.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${row("Assinado em", dateStr)}
    <div style="margin-top:16px;padding:14px 18px;background:#0A2018;border-radius:8px;border-left:3px solid #10B981;">
      <p style="margin:0 0 4px;font-size:11px;color:#7A96AF;">Status</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#10B981;">✅ Assinatura Registrada</p>
    </div>
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Aguardando a contra-assinatura da V3 Partners. Você receberá o contrato
      finalizado assim que nossa equipe concluir a assinatura.
    </p>
  `;
  await send(
    opts.clientEmail,
    `✅ Assinatura registrada — V3 Partners · ${opts.proposalCode}`,
    template("Assinatura Registrada", body)
  );
}

/** V3 Rep: link para contra-assinar após cliente assinar */
export async function notifyV3ParaAssinar(opts: {
  repEmail: string;
  clientName: string;
  clientEmail: string;
  proposalCode: string;
  creditLine: string;
  signedAt: string;
  v3SigningUrl: string;
}) {
  const dateStr = new Date(opts.signedAt).toLocaleString("pt-BR");
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      O cliente assinou o mandato e aguarda a contra-assinatura da V3 Partners.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Cliente", opts.clientName)}
    ${row("E-mail", opts.clientEmail)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${row("Assinado pelo cliente em", dateStr)}
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Clique no botão abaixo para revisar e assinar o contrato como representante da V3 Partners.
    </p>
  `;
  await send(
    opts.repEmail,
    `✍️ Contra-assinatura necessária — ${opts.clientName} · ${opts.proposalCode}`,
    template("Cliente Assinou — Sua Assinatura é Necessária", body, {
      label: "Assinar como V3 Partners",
      url: opts.v3SigningUrl,
    })
  );
}

/** Ambos: contrato totalmente assinado */
export async function notifyContratoCompleto(opts: {
  clientEmail: string;
  clientName: string;
  repEmail: string;
  proposalCode: string;
  creditLine: string;
  clientSignedAt: string;
  v3SignedAt: string;
  v3SignerName: string;
}) {
  const clientDate = new Date(opts.clientSignedAt).toLocaleString("pt-BR");
  const v3Date = new Date(opts.v3SignedAt).toLocaleString("pt-BR");

  const clientBody = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.clientName}</strong>!
      O contrato está totalmente assinado por ambas as partes.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${row("Assinado por você em", clientDate)}
    ${row("Assinado pela V3 Partners em", v3Date)}
    <div style="margin-top:16px;padding:14px 18px;background:#0A2018;border-radius:8px;border-left:3px solid #10B981;">
      <p style="margin:0;font-size:20px;font-weight:800;color:#10B981;">✅ Contrato Finalizado</p>
    </div>
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Nossa equipe já está trabalhando na estruturação da sua operação de crédito.
      Em breve entraremos em contato. Obrigado pela confiança na V3 Partners!
    </p>
  `;
  await send(
    opts.clientEmail,
    `✅ Contrato finalizado — V3 Partners · ${opts.proposalCode}`,
    template("Contrato Totalmente Assinado", clientBody)
  );

  const repBody = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Contrato totalmente assinado por ambas as partes.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Cliente", opts.clientName)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${row("Assinatura do cliente", clientDate)}
    ${row("Contra-assinatura V3", v3Date)}
    ${row("Representante V3", opts.v3SignerName)}
    <div style="margin-top:16px;padding:14px 18px;background:#0A2018;border-radius:8px;border-left:3px solid #10B981;">
      <p style="margin:0;font-size:20px;font-weight:800;color:#10B981;">✅ Mandato Finalizado</p>
    </div>
  `;
  await send(
    opts.repEmail,
    `✅ Mandato finalizado — ${opts.clientName} · ${opts.proposalCode}`,
    template("Contrato Totalmente Assinado", repBody, {
      label: "Ver na Mesa Operacional",
      url: "https://v3-partner.vercel.app/mesa-operacional",
    })
  );
}

/** Todos os envolvidos: contrato 100% assinado — cópia com dados de assinatura */
export async function notifyContratoFinalizado(opts: {
  proposalCode: string;
  creditLine: string;
  contratoUrl: string | null;
  // Assinantes
  clientName: string;    clientEmail: string;    clientData: string | null;  clientIp: string | null;
  v3Nome: string;        v3Email: string;         v3Data: string | null;      v3Ip: string | null;
  t1Nome: string | null; t1Email: string | null;  t1Data: string | null;      t1Ip: string | null;
  t2Nome: string | null; t2Email: string | null;  t2Data: string | null;      t2Ip: string | null;
}) {
  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

  const assinRow = (papel: string, nome: string, email: string, data: string | null, ip: string | null) => `
    <div style="margin-bottom:12px;padding:12px 16px;background:#13243D;border-radius:10px;border-left:3px solid #C9A84C;">
      <div style="font-size:10px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${papel}</div>
      <div style="font-size:13px;font-weight:600;color:#C8D4E3;">${nome}</div>
      <div style="font-size:12px;color:#7A96AF;">${email}</div>
      <div style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap;">
        <span style="font-size:11px;color:#7A96AF;">📅 ${fmt(data)}</span>
        <span style="font-size:11px;color:#7A96AF;font-family:monospace;">🌐 ${ip ?? "—"}</span>
      </div>
    </div>`;

  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      O Contrato de Mandato foi <strong style="color:#10B981;">totalmente assinado</strong> por todas as partes.
      Abaixo estão os registros completos de cada assinatura eletrônica.
    </p>
    ${row("Proposta", opts.proposalCode)}
    ${row("Linha de Crédito", opts.creditLine)}
    <div style="margin-top:20px;margin-bottom:8px;">
      <span style="font-size:11px;font-weight:700;color:#7A96AF;text-transform:uppercase;letter-spacing:1px;">Assinaturas registradas</span>
    </div>
    ${assinRow("Contratante (Cliente)", opts.clientName, opts.clientEmail, opts.clientData, opts.clientIp)}
    ${assinRow("Contratada — V3 Partners", opts.v3Nome, opts.v3Email, opts.v3Data, opts.v3Ip)}
    ${opts.t1Nome ? assinRow("1ª Testemunha (Parceiro Originador)", opts.t1Nome, opts.t1Email ?? "—", opts.t1Data, opts.t1Ip) : ""}
    ${opts.t2Nome ? assinRow("2ª Testemunha (Institucional)", opts.t2Nome, opts.t2Email ?? "—", opts.t2Data, opts.t2Ip) : ""}
    <p style="color:#7A96AF;font-size:12px;margin-top:16px;">
      Assinaturas com plena validade jurídica nos termos da MP 2.200-2/2001 e Lei 14.063/2020.
    </p>
  `;

  const subject = `✅ Contrato assinado — ${opts.clientName} · ${opts.proposalCode}`;
  const cta = opts.contratoUrl ? { label: "Baixar Certificado de Assinatura", url: opts.contratoUrl } : undefined;

  const destinatarios = [
    opts.clientEmail,
    opts.v3Email,
    opts.t1Email,
    opts.t2Email,
  ].filter((e): e is string => !!e && e.length > 0);

  await Promise.allSettled(
    destinatarios.map((to) =>
      send(to, subject, template("Contrato Totalmente Assinado", body, cta))
    )
  );
}

/** Testemunha2 (Aline/financeiro): link para assinar após testemunha1 assinar */
export async function notifyTestemunha2ParaAssinar(opts: {
  testemunhaEmail: string;
  testemunhaNome: string;
  clientName: string;
  proposalCode: string;
  creditLine: string;
  testemunhaUrl: string;
}) {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.testemunhaNome}</strong>!
      O contrato do cliente abaixo foi assinado pelo contratante, pela V3 Partners e pelo
      parceiro originador. Aguarda agora a sua assinatura como
      <strong style="color:#E5B96A;">segunda testemunha</strong>.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Cliente", opts.clientName)}
    ${row("Linha de Crédito", opts.creditLine)}
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Clique no botão abaixo para revisar e assinar como testemunha do contrato.
    </p>
  `;
  await send(
    opts.testemunhaEmail,
    `✍️ Sua assinatura como testemunha — ${opts.clientName} · ${opts.proposalCode}`,
    template("Assinatura de Testemunha Necessária (2ª)", body, {
      label: "Assinar como Testemunha",
      url: opts.testemunhaUrl,
    })
  );
}

/** Testemunha (partner): link para assinar como testemunha após V3 assinar */
export async function notifyTestemunhaParaAssinar(opts: {
  testemunhaEmail: string;
  testemunhaNome: string;
  clientName: string;
  proposalCode: string;
  creditLine: string;
  testemunhaUrl: string;
}) {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.testemunhaNome}</strong>!
      O contrato referente ao seu cliente foi assinado pelas partes e aguarda
      a sua assinatura como <strong style="color:#E5B96A;">testemunha</strong>.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Cliente", opts.clientName)}
    ${row("Linha de Crédito", opts.creditLine)}
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      Clique no botão abaixo para assinar como testemunha do contrato.
    </p>
  `;
  await send(
    opts.testemunhaEmail,
    `✍️ Assine como testemunha — ${opts.clientName} · ${opts.proposalCode}`,
    template("Assinatura de Testemunha Necessária", body, {
      label: "Assinar como Testemunha",
      url: opts.testemunhaUrl,
    })
  );
}

/** Qualquer assinante: confirmação de que sua assinatura foi registrada */
export async function notifyAssinaturaRegistrada(opts: {
  email: string;
  nome: string;
  papel: string;
  proposalCode: string;
  clientName: string;
  signedAt: string;
}): Promise<void> {
  const dateStr = new Date(opts.signedAt).toLocaleString("pt-BR");
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.nome}</strong>!<br>
      Sua assinatura como <strong style="color:#E5B96A;">${opts.papel}</strong> foi registrada com sucesso.
    </p>
    ${row("Proposta", opts.proposalCode)}
    ${row("Cliente", opts.clientName)}
    ${row("Registrado em", dateStr)}
    <div style="margin-top:16px;padding:14px 18px;background:#0A2018;border-radius:8px;border-left:3px solid #10B981;">
      <p style="margin:0;font-size:20px;font-weight:800;color:#10B981;">✅ Assinatura Registrada</p>
    </div>
    <p style="color:#7A96AF;font-size:12px;margin-top:16px;">
      Aguardando as demais assinaturas para finalização do contrato.
    </p>
  `;
  await send(
    opts.email,
    `✅ Assinatura registrada — V3 Partners · ${opts.proposalCode}`,
    template("Assinatura Registrada com Sucesso", body)
  );
}

/** Partner: e-mail de boas-vindas ao ser cadastrado */
export async function sendWelcomePartner(opts: {
  partnerEmail: string;
  partnerName: string;
  plano: string;
  loginUrl: string;
  contratoUrl: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !opts.partnerEmail) return;

  const comissao = opts.plano === "Partner PRO" ? "50%" : "30%";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09081A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:22px;font-weight:800;letter-spacing:4px;color:#C9A84C;margin:0;">V3 PARTNERS</p>
      <p style="font-size:11px;color:#7A8FA8;margin:4px 0 0;letter-spacing:1px;">PLATAFORMA FINANCEIRA</p>
    </div>
    <div style="background:#111F35;border:1px solid #243A66;border-radius:16px;padding:32px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 12px;">Bem-vindo(a)!</p>
      <h1 style="font-size:22px;font-weight:700;color:#F0ECE4;margin:0 0 8px;">Olá, ${opts.partnerName}!</h1>
      <p style="font-size:14px;color:#7A8FA8;margin:0 0 28px;line-height:1.6;">
        Sua conta <strong style="color:#C9A84C;">${opts.plano}</strong> foi criada com sucesso.
        Com ela você acessa operações com até <strong style="color:#C9A84C;">${comissao}</strong> de comissionamento.
      </p>
      <div style="background:#0A1628;border:1px solid #243A66;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:#7A8FA8;text-transform:uppercase;margin:0 0 16px;">Seus dados de acesso</p>
        <div style="margin-bottom:12px;">
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">E-mail</p>
          <p style="font-size:15px;color:#F0ECE4;font-weight:600;margin:0;">${opts.partnerEmail}</p>
        </div>
        <div>
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">Senha temporária</p>
          <p style="font-size:20px;color:#C9A84C;font-weight:700;font-family:monospace;letter-spacing:4px;margin:0;">12345678</p>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:20px;">
        <a href="${opts.loginUrl}"
           style="display:inline-block;background:#C9A84C;color:#09081A;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">
          Acessar Plataforma →
        </a>
      </div>
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="font-size:13px;color:#C9A84C;margin:0;line-height:1.5;">
          <strong>Próximo passo:</strong> Assine o contrato de parceria para liberar todas as funcionalidades.
        </p>
      </div>
      <div style="text-align:center;">
        <a href="${opts.contratoUrl}"
           style="display:inline-block;border:1px solid #C9A84C;color:#C9A84C;font-size:13px;font-weight:600;padding:10px 28px;border-radius:10px;text-decoration:none;">
          Assinar Contrato de Parceria
        </a>
      </div>
    </div>
    <p style="font-size:11px;color:#3A5070;text-align:center;margin:0;">
      © 2026 V3 Partners · E-mail automático, não responda.
    </p>
  </div>
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
        to: [opts.partnerEmail],
        subject: `Bem-vindo(a) à V3 Partners — ${opts.plano}`,
        html,
      }),
    });
  } catch { /* silent */ }
}

/** Partner: relatório mensal de comissões e operações */
export async function sendMonthlyReport(opts: {
  partnerEmail: string;
  partnerName: string;
  plano: string;
  mes: string;
  totalRecebido: number;
  totalPendente: number;
  totalOperacoes: number;
  totalComissoes: number;
}): Promise<void> {
  const semMovimento = opts.totalComissoes === 0 && opts.totalOperacoes === 0;
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.partnerName}</strong>!
      Aqui está o resumo das suas atividades em <strong style="color:#E5B96A;">${opts.mes}</strong>.
    </p>
    ${row("Plano", opts.plano)}
    ${row("Total de Operações", String(opts.totalOperacoes))}
    ${row("Total de Comissões", String(opts.totalComissoes))}
    ${highlight("Comissões Recebidas", moeda(opts.totalRecebido), "#10B981")}
    ${opts.totalPendente > 0 ? highlight("Comissões a Receber", moeda(opts.totalPendente), "#F59E0B") : ""}
    ${semMovimento ? `
    <div style="margin-top:16px;padding:14px 18px;background:#13243D;border-radius:8px;border-left:3px solid #7A96AF;">
      <p style="margin:0;font-size:13px;color:#7A96AF;">
        Nenhuma operação registrada este mês. Que tal indicar novos clientes para aumentar suas comissões?
      </p>
    </div>` : ""}
    <p style="color:#7A96AF;font-size:12px;margin-top:20px;">
      Acesse a plataforma para ver o extrato completo e os detalhes das suas operações.
    </p>
  `;
  await send(
    opts.partnerEmail,
    `📊 Seu relatório mensal V3 — ${opts.mes}`,
    template(`Relatório de ${opts.mes}`, body, {
      label: "Ver Detalhes na Plataforma",
      url: "https://v3-partner.vercel.app/minha-assinatura",
    })
  );
}

/** Partner: novo comentário da mesa em sua proposta */
export async function notifyComentarioProposta(opts: {
  partnerEmail: string;
  partnerName: string;
  proposalCode: string;
  proposalTitle: string;
  creditLine: string;
  autor: string;
  comentario: string;
}): Promise<void> {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.partnerName}</strong>!
      A Mesa Operacional adicionou um comentário na sua proposta.
    </p>
    ${row("Código", opts.proposalCode)}
    ${row("Título", opts.proposalTitle)}
    ${row("Linha de Crédito", opts.creditLine)}
    ${row("Enviado por", opts.autor)}
    <div style="margin-top:16px;padding:16px 18px;background:#13243D;border-radius:8px;border-left:3px solid #C4922E;">
      <p style="margin:0 0 6px;font-size:11px;color:#7A96AF;text-transform:uppercase;letter-spacing:1px;">Mensagem</p>
      <p style="margin:0;font-size:14px;color:#C8D4E3;line-height:1.6;">${opts.comentario}</p>
    </div>
    <p style="color:#7A96AF;font-size:12px;margin-top:16px;">
      Acesse a plataforma para ver todos os comentários e responder se necessário.
    </p>
  `;
  await send(
    opts.partnerEmail,
    `💬 Novo comentário na proposta ${opts.proposalCode}`,
    template("Comentário da Mesa Operacional", body, {
      label: "Ver Proposta",
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://v3-partner.vercel.app"}/mesa-credito`,
    })
  );
}

/** Partner: comissão marcada como paga */
export async function notifyComissaoPaga(opts: {
  partnerEmail: string;
  partnerName: string;
  commissionCode: string;
  operationDescription: string;
  commissionValue: number;
}) {
  const body = `
    <p style="color:#7A96AF;font-size:14px;margin:0 0 20px;">
      Olá, <strong style="color:#C8D4E3;">${opts.partnerName}</strong>!
      Sua comissão foi liquidada.
    </p>
    ${row("Código", opts.commissionCode)}
    ${row("Operação", opts.operationDescription)}
    ${row("Data do Pagamento", new Date().toLocaleDateString("pt-BR"))}
    <div style="margin-top:16px;padding:14px 18px;background:#0A2018;
                border-radius:8px;border-left:3px solid #10B981;">
      <p style="margin:0 0 4px;font-size:11px;color:#7A96AF;">Valor pago</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#10B981;">
        ✅ ${moeda(opts.commissionValue)}
      </p>
    </div>
    <p style="color:#7A96AF;font-size:13px;margin-top:16px;">
      O valor foi liquidado conforme acordado. Acesse a plataforma para ver o extrato completo.
    </p>
  `;
  await send(
    opts.partnerEmail,
    `✅ Comissão paga — ${moeda(opts.commissionValue)}`,
    template("Comissão Liquidada", body, {
      label: "Ver Extrato",
      url: "https://v3-partner.vercel.app/comissoes",
    })
  );
}

/** Partner: e-mail de boas-vindas no primeiro acesso */
export async function notifyBoasVindasPartner(opts: {
  partnerEmail: string;
  partnerName: string;
  plano: string;
}): Promise<void> {
  const planoLabel = opts.plano === "PARTNER_PRO" ? "Partner PRO" : "Partner";
  const comissao  = opts.plano === "PARTNER_PRO" ? "50%" : "30%";
  const body = `
    <p style="color:#C8D4E3;font-size:15px;margin:0 0 8px;font-weight:700;">
      Bem-vindo à V3 Partners, ${opts.partnerName}! 🎉
    </p>
    <p style="color:#7A96AF;font-size:14px;margin:0 0 24px;">
      Sua conta <strong style="color:#E8C97A;">${planoLabel}</strong> está ativa.
      Você tem ${comissao} de comissionamento em todas as operações fechadas.
      Veja abaixo como começar a operar hoje mesmo.
    </p>
    <div style="background:#0D1C2E;border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">PRIMEIROS PASSOS</p>
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
        <div style="min-width:28px;height:28px;background:#C9A84C20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#C9A84C;">1</div>
        <div>
          <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#F0ECE4;">Cadastre seus leads no CRM</p>
          <p style="margin:0;font-size:12px;color:#7A96AF;">Organize seus contatos e acompanhe cada negociação</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
        <div style="min-width:28px;height:28px;background:#C9A84C20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#C9A84C;">2</div>
        <div>
          <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#F0ECE4;">Envie sua primeira proposta de crédito</p>
          <p style="margin:0;font-size:12px;color:#7A96AF;">Nossa Mesa de Crédito analisa em até 48h</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div style="min-width:28px;height:28px;background:#C9A84C20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#C9A84C;">3</div>
        <div>
          <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#F0ECE4;">Acesse o Academy</p>
          <p style="margin:0;font-size:12px;color:#7A96AF;">Capacite-se para fechar operações maiores e mais complexas</p>
        </div>
      </div>
    </div>
    ${row("Plano", planoLabel)}
    ${row("Comissionamento", comissao)}
    ${row("Suporte", "operacional@v3partners.com.br")}
    <p style="color:#7A96AF;font-size:12px;margin-top:20px;">
      Nossa equipe está disponível para apoiar você em cada operação. Boas vendas! 🚀
    </p>
  `;
  await send(
    opts.partnerEmail,
    `🎉 Bem-vindo à V3 Partners, ${opts.partnerName}!`,
    template("Sua conta V3 está ativa", body, {
      label: "Acessar a Plataforma",
      url: "https://app.v3partners.com.br/dashboard",
    })
  );
}

/** Admin: lembrete de onboarding específico por etapa */
export async function notifyLembreteOnboardingEtapa(opts: {
  partnerEmail: string;
  partnerName: string;
  plano: string;
  step: string;
}): Promise<void> {
  const planoLabel = opts.plano === "PARTNER_PRO" ? "Partner PRO" : "Partner";

  type StepConfig = {
    emoji: string;
    title: string;
    subject: string;
    body: string;
    cta: { label: string; url: string };
  };

  const stepMap: Record<string, StepConfig> = {
    profile: {
      emoji: "👤",
      subject: `👤 Complete seu perfil na V3, ${opts.partnerName}`,
      title: "Seu perfil ainda está incompleto",
      body: `
        <p style="color:#C8D4E3;font-size:14px;margin:0 0 16px;">
          Olá, <strong>${opts.partnerName}</strong>! 👋<br><br>
          Notamos que seu perfil na V3 Partners ainda está incompleto.
          Ter um perfil completo aumenta sua credibilidade e é o primeiro passo para operar.
        </p>
        <div style="background:#0D1C2E;border-radius:10px;padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">O QUE PREENCHER</p>
          <p style="margin:0;font-size:13px;color:#7A96AF;line-height:1.8;">
            • Nome completo<br>• Telefone de contato<br>• Cidade e estado
          </p>
        </div>
        <p style="color:#7A96AF;font-size:13px;">Leva menos de 1 minuto. Clique abaixo para completar agora.</p>
      `,
      cta: { label: "Completar Perfil", url: "https://app.v3partners.com.br/perfil" },
    },
    crm: {
      emoji: "👥",
      subject: `👥 Cadastre seu primeiro lead no CRM V3, ${opts.partnerName}`,
      title: "Você ainda não tem leads no CRM",
      body: `
        <p style="color:#C8D4E3;font-size:14px;margin:0 0 16px;">
          Olá, <strong>${opts.partnerName}</strong>! 👋<br><br>
          O CRM é onde tudo começa. Cada lead cadastrado é um potencial negócio e uma comissão futura.
          Você ainda não registrou nenhum cliente.
        </p>
        <div style="background:#0D1C2E;border-radius:10px;padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">POR QUE USAR O CRM</p>
          <p style="margin:0;font-size:13px;color:#7A96AF;line-height:1.8;">
            • Organize todos seus contatos em um só lugar<br>
            • Acompanhe o status de cada negociação<br>
            • Programe follow-ups e nunca perca um lead<br>
            • Histórico completo de interações
          </p>
        </div>
        <p style="color:#7A96AF;font-size:13px;">Cadastre seu primeiro lead agora e comece a construir sua carteira.</p>
      `,
      cta: { label: "Acessar o CRM", url: "https://app.v3partners.com.br/crm" },
    },
    proposta: {
      emoji: "📝",
      subject: `📝 Envie sua primeira proposta de crédito, ${opts.partnerName}`,
      title: "Sua primeira proposta está te esperando",
      body: `
        <p style="color:#C8D4E3;font-size:14px;margin:0 0 16px;">
          Olá, <strong>${opts.partnerName}</strong>! 👋<br><br>
          Você é <strong style="color:#E8C97A;">${planoLabel}</strong> e ainda não enviou nenhuma proposta para a Mesa de Crédito.
          Cada proposta aprovada gera comissão direta para você.
        </p>
        <div style="background:#0D1C2E;border-radius:10px;padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">NOSSAS LINHAS DE CRÉDITO</p>
          <p style="margin:0;font-size:13px;color:#7A96AF;line-height:1.8;">
            • Crédito Varejo (N1) — até R$500K<br>
            • Crédito Estruturado (N2) — R$500K a R$5M<br>
            • High Ticket (N3) — acima de R$5M
          </p>
        </div>
        <p style="color:#7A96AF;font-size:13px;">Nossa Mesa analisa em até 48h. Envie sua primeira proposta agora.</p>
      `,
      cta: { label: "Ir para a Mesa de Crédito", url: "https://app.v3partners.com.br/mesa-credito" },
    },
    welcome_email: {
      emoji: "✉️",
      subject: `✉️ Bem-vindo à V3 Partners, ${opts.partnerName}!`,
      title: "Sua conta V3 está ativa",
      body: `
        <p style="color:#C8D4E3;font-size:14px;margin:0 0 16px;">
          Olá, <strong>${opts.partnerName}</strong>! 👋<br><br>
          Sua conta <strong style="color:#E8C97A;">${planoLabel}</strong> na V3 Partners está ativa e pronta para operar.
          Acesse a plataforma e conheça todos os módulos disponíveis para você.
        </p>
        <p style="color:#7A96AF;font-size:13px;">Qualquer dúvida, nossa equipe está disponível para ajudar.</p>
      `,
      cta: { label: "Acessar a Plataforma", url: "https://app.v3partners.com.br/dashboard" },
    },
  };

  const cfg = stepMap[opts.step] ?? stepMap.profile;

  await send(
    opts.partnerEmail,
    cfg.subject,
    template(cfg.title, cfg.body, cfg.cta)
  );
}

/** Partner: resumo diário de follow-ups do CRM */
export async function notifyFollowUpsDodia(opts: {
  partnerEmail: string;
  partnerName: string;
  followUpsHoje: Array<{ name: string; phone: string | null; segment: string | null }>;
  leadsEsquecidos: Array<{ name: string; diasSemContato: number }>;
}): Promise<void> {
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const listaHoje = opts.followUpsHoje.length > 0
    ? opts.followUpsHoje.map((l) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1B3050;">
          <div style="min-width:32px;height:32px;background:#C9A84C20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;">📞</div>
          <div>
            <p style="margin:0;font-size:13px;font-weight:600;color:#F0ECE4;">${l.name}</p>
            <p style="margin:0;font-size:11px;color:#7A96AF;">${l.phone ?? "Sem telefone"}${l.segment ? ` · ${l.segment}` : ""}</p>
          </div>
        </div>`).join("")
    : `<p style="color:#7A96AF;font-size:13px;">Nenhum follow-up agendado para hoje.</p>`;

  const listaEsquecidos = opts.leadsEsquecidos.length > 0
    ? `<div style="margin-top:20px;padding:16px;background:#1A0A0A;border-radius:8px;border-left:3px solid #EF4444;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#EF4444;letter-spacing:0.08em;">⚠ LEADS SEM CONTATO HÁ 7+ DIAS</p>
        ${opts.leadsEsquecidos.map((l) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #2A1010;">
            <span style="font-size:13px;color:#F0ECE4;">${l.name}</span>
            <span style="font-size:11px;font-weight:700;color:#EF4444;">${l.diasSemContato}d sem contato</span>
          </div>`).join("")}
      </div>`
    : "";

  const body = `
    <p style="color:#C8D4E3;font-size:14px;margin:0 0 4px;">Olá, <strong>${opts.partnerName}</strong>!</p>
    <p style="color:#7A96AF;font-size:13px;margin:0 0 20px;">Aqui estão seus follow-ups para <strong style="color:#E8C97A;">${hoje}</strong>.</p>
    <div style="background:#0D1C2E;border-radius:10px;padding:16px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">
        📞 FOLLOW-UPS DE HOJE (${opts.followUpsHoje.length})
      </p>
      ${listaHoje}
    </div>
    ${listaEsquecidos}
    <p style="color:#7A96AF;font-size:12px;margin-top:16px;">
      Acesse o CRM para registrar as interações e reagendar os próximos contatos.
    </p>
  `;

  await send(
    opts.partnerEmail,
    `📞 ${opts.followUpsHoje.length} follow-up${opts.followUpsHoje.length !== 1 ? "s" : ""} para hoje — V3 Partners`,
    template("Seus follow-ups do dia", body, {
      label: "Abrir CRM",
      url:   "https://app.v3partners.com.br/crm",
    })
  );
}

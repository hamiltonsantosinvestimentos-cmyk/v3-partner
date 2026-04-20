import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "V3 Partners <noreply@v3partners.com.br>";

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

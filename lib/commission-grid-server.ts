import { randomBytes } from "crypto";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import { COMMISSION_GROUP_LABELS, COMMISSION_TOKEN_DAYS, commissionLink, type CommissionGroup } from "@/lib/commission-grid";

export function newGridToken(): string {
  return randomBytes(24).toString("hex"); // 48 caracteres, aleatório
}

/** Convite por e-mail ao representante (mesmo padrão do convite de qualificação, com o Brand Guardian). */
export async function sendGridInvite(params: { to: string; name: string; group: CommissionGroup; token: string }) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const label = COMMISSION_GROUP_LABELS[params.group];
    const subjectGate = auditText(`Divisão da comissão: ${label}, V3 Partners`);
    const htmlGate = auditHtml(`<p>Olá ${params.name},</p>
       <p>Você foi indicado(a) como representante do grupo <strong>${label}</strong> para informar a divisão percentual da comissão entre os integrantes do grupo.</p>
       <p>Preencha pelo link: ${commissionLink(params.token)}</p>
       <p>O link vale por ${COMMISSION_TOKEN_DAYS} dias e, depois de confirmado, a divisão fica travada.</p>`);
    if (htmlGate.blocking.length > 0) console.error("[commission-grids] Brand Guardian bloqueou:", htmlGate.blocking);
    await resend.emails.send({ from: "V3 Partners <noreply@v3partners.com.br>", to: params.to, subject: subjectGate.corrected, html: htmlGate.corrected });
    return true;
  } catch (err) {
    console.error("[commission-grids] falha ao enviar convite:", err);
    return false;
  }
}


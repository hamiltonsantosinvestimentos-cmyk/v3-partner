/**
 * COMUNICADO DA APROVAÇÃO DO V3 ENTERPRISE (BRIEF 10/11/2026:
 * docs/briefs/2026-11-10_aprovacao-enterprise-comunicado-white-label.md)
 *
 * Funções puras, sem rede: textos do e-mail e do WhatsApp, regra do telefone e o phone gravado no
 * histórico do SDR. Usado por app/api/cadastro-partner/aprovar e pelo modal de /admin-cadastros.
 * A senha provisória nunca entra no texto do WhatsApp (só no e-mail de boas-vindas, como sempre).
 */

/** Os 67 DDDs brasileiros (Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type TelefoneEnvio =
  | { ok: true; digitos: string; exibicao: string }
  | { ok: false; motivo: string };

/** DDD + número (10 ou 11 dígitos) válido? Devolve o motivo quando não é. */
function nacionalValido(n: string): string | null {
  if (n.length !== 10 && n.length !== 11) return "telefone fora do padrão brasileiro: envie à mão";
  if (!DDDS.has(Number(n.slice(0, 2)))) return "DDD inexistente: envie à mão";
  if (n.length === 11 && n[2] !== "9") return "celular sem o 9 depois do DDD: envie à mão";
  return null;
}

/**
 * Regra do telefone para o envio automático (seção "Telefone" do BRIEF). Número estrangeiro ou ambíguo
 * nunca é enviado automaticamente.
 */
export function telefoneBrasilParaEnvio(telefone: string | null | undefined): TelefoneEnvio {
  const bruto = String(telefone ?? "").trim();
  const d = bruto.replace(/\D/g, "");
  if (!d) return { ok: false, motivo: "cadastro sem telefone" };
  let nacional: string;
  if (bruto.startsWith("+")) {
    if (!d.startsWith("55")) return { ok: false, motivo: "número estrangeiro: envie à mão" };
    nacional = d.slice(2);
  } else if (d.length === 10 || d.length === 11) {
    nacional = d;
  } else if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    nacional = d.slice(2);
  } else {
    return { ok: false, motivo: "telefone fora do padrão brasileiro: envie à mão" };
  }
  const erro = nacionalValido(nacional);
  if (erro) return { ok: false, motivo: erro };
  const ddd = nacional.slice(0, 2), resto = nacional.slice(2);
  const exibicao = `+55 (${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
  return { ok: true, digitos: `55${nacional}`, exibicao };
}

/**
 * Phone gravado em sdr_conversas e sdr_leads: o mesmo valor que o webhook do SDR monta com
 * chatIdToPhone(chatId), para a trava humano_ativo bater (JID canônico pode ter 12 dígitos).
 * Sem check válido, cai no número dialável.
 */
export function phoneParaHistorico(check: { existe: boolean; chatId: string | null } | null, digitos: string): string {
  if (check?.existe && check.chatId) return check.chatId.replace(/@(c\.us|s\.whatsapp\.net|g\.us)$/, "");
  return digitos;
}

export type DadosComunicado = { nome: string; empresa: string; email: string };

function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "Parceiro";
}

/** Texto do WhatsApp. Sem senha e sem travessão. */
export function mensagemWhatsappEnterprise(d: DadosComunicado): string {
  return `Olá, ${primeiroNome(d.nome)}! Tudo bem?

Aqui é da *V3 Partners*. O cadastro da *${d.empresa.trim()}* no plano *V3 Enterprise* foi aprovado. 🎉

Você vai receber no e-mail *${d.email.trim()}* o seu login e a senha provisória. No primeiro acesso, a plataforma pede para você criar a sua senha pessoal.

Nos próximos dias, o nosso *time técnico e comercial* vai entrar em contato para começar a estruturação do seu *white label*, com os *10 acessos* previstos em contrato.

Qualquer dúvida, é só responder aqui.`;
}

/** Bloco do e-mail de boas-vindas, só no Enterprise. Paleta V3. */
export function blocoWhiteLabelEmailHtml(): string {
  return `
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:12px;padding:16px;margin:0 0 24px;">
        <p style="font-size:13px;color:#F0ECE4;margin:0;line-height:1.6;">
          <strong style="color:#C9A84C;">Próximos passos do seu white label.</strong> Nos próximos dias, o nosso
          <strong style="color:#C9A84C;">time técnico e comercial</strong> vai entrar em contato para começar a estruturação do seu
          <strong style="color:#C9A84C;">white label</strong>, com os <strong style="color:#C9A84C;">10 acessos</strong> previstos em contrato.
        </p>
      </div>`;
}

/** Assunto do e-mail de boas-vindas (todos os planos), sem travessão. */
export const ASSUNTO_BOAS_VINDAS = "Bem-vindo à V3 Partners: Cadastro Aprovado!";

/** Texto do modal vermelho de confirmação em /admin-cadastros. */
export function textoConfirmacaoEnterprise(d: { empresa: string; email: string; telefone: string | null | undefined }): string {
  const t = telefoneBrasilParaEnvio(d.telefone);
  const linhaWhats = t.ok
    ? `WhatsApp com o aviso, sem a senha, para:\n${t.exibicao}`
    : `WhatsApp não será enviado: ${t.motivo}.`;
  return `Isso cria o login de ${d.empresa.trim()} e envia na hora, sem volta:

E-mail com login, senha provisória e o aviso do white label (10 acessos previstos em contrato) para:
${d.email.trim()}

${linhaWhats}`;
}

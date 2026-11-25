// Regras puras do remetente e do texto dos e-mails do Enterprise (sem IO, testáveis).
// BRIEF docs/briefs/2026-11-25_emails-remetente-enterprise.md

/** Nome de exibição seguro para o cabeçalho From: sem aspas, <>, quebras de linha; até 60 caracteres. */
export function nomeRemetente(nome: string | null | undefined): string | null {
  const limpo = String(nome ?? "").replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60).trim();
  return limpo || null;
}

/**
 * Remetente da marca, ou null. Só com o domínio ativo na plataforma e EXATAMENTE igual a um
 * domínio verificado no Resend (subdomínio de plataforma não casa com a raiz, de propósito).
 */
export function montarRemetente(opts: {
  nome: string | null | undefined;
  dominio: string | null | undefined;
  status: string | null | undefined;
  verificados: Set<string>;
}): string | null {
  const dominio = String(opts.dominio ?? "").trim().toLowerCase();
  if (!dominio || opts.status !== "ativo" || !opts.verificados.has(dominio)) return null;
  const nome = nomeRemetente(opts.nome);
  if (!nome) return null;
  return `"${nome}" <naoresponda@${dominio}>`;
}

/** E-mail como padrão literal de ilike: escapa os curingas % e _ (e a barra). */
export function emailParaIlike(email: string): string {
  return email.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Lista FECHADA de frases institucionais trocadas pela marca. Trechos em que a V3 é parte de
 * contrato (contra-assinatura, "Contratada — V3 Partners", "Assinar como V3 Partners",
 * assuntos de contrato) ficam V3 de propósito: não estão nesta lista.
 */
const TROCAS: [RegExp, (m: string) => string][] = [
  [/V3 Partners · Plataforma Financeira/g, (m) => `${m} · Powered by V3 Partners`],
  [/Bem-vindo\(a\) à V3 Partners/g, (m) => `Bem-vindo(a) à ${m}`],
  [/Bem-vindo à V3 Partners/g, (m) => `Bem-vindo à ${m}`],
  [/seu perfil na V3 Partners/g, (m) => `seu perfil na ${m}`],
  [/na V3 Partners está ativa/g, (m) => `na ${m} está ativa`],
];

/** Troca as frases da lista pelo nome da marca. `html` escapa o nome para o corpo; o assunto vai cru. */
export function trocarTextoV3(texto: string, marca: string | null | undefined, html: boolean): string {
  const nome = nomeRemetente(marca);
  if (!nome) return texto;
  const n = html ? escaparHtml(nome) : nome;
  let out = texto;
  for (const [re, f] of TROCAS) out = out.replace(re, () => f(n));
  return out;
}

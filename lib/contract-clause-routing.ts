// lib/contract-clause-routing.ts
//
// Cláusula 7.1 dinâmica (BRIEF NCNDA formatação, 22/09/2026, achado real
// comparando o modelo do Dr. Luis contra a minuta aprovada: a 7.1 hoje é
// prosa estática ("...sempre com cópia para o Head V3 Partners..."). O
// modelo novo troca isso por um bloco de roteamento explícito, hierárquico:
// Head V3 (destinatário principal) → c/c V3 fixo + Partner → Mandatário
// (destinatário do bloco 2) → c/c Intermediários. Gera a variável
// {{clausula_7_1_roteamento_emails}}, disponível para uso em minuta nova ou
// numa futura revisão da minuta aprovada -- NUNCA aplicada sozinha ao texto
// já aprovado (isso é edição de conteúdo jurídico, passa pelo gate de
// @contract-legal-guardian e novo voto do Dr. Athaydes, decisão de João em
// 22/09/2026: construir o gerador agora, aplicar só depois do voto).
//
// Fallback (achado do QA de governança antes do "go", 22/09/2026): papel
// ausente no lote (ex: sem Mandatário) nunca deixa e-mail vazio nem quebra a
// cláusula -- o bloco inteiro daquele papel é omitido. Sem intermediário
// nenhum, o Mandatário some do "c/c" (fica só o destinatário principal). Sem
// NEM Mandatário nem Intermediário, o primeiro deles vira o destinatário
// principal do bloco 2 em vez de deixar um "c/c" sem ninguém endereçado.
import { partyRoleSortKey } from "@/lib/qualification-roles";

export interface ClauseRoutingParty {
  role: string;
  name: string;
  email?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const V3_FIXED_EMAIL = "joao.lemos@v3partners.com.br";

/**
 * Monta o corpo HTML da cláusula 7.1 dinâmica. Devolve null quando falta o
 * mínimo indispensável (e-mail do Head) -- o chamador decide o fallback
 * (placeholder "[ INFORMAÇÃO PENDENTE ]", nunca texto quebrado).
 */
export function buildDynamicEmailRoutingClause(
  parties: ClauseRoutingParty[],
  headEmail: string | null | undefined,
): string | null {
  const head = (headEmail ?? "").trim();
  if (!head) return null;

  const withEmail = parties.filter((p) => p.email?.trim());
  const partner = withEmail.find((p) => p.role === "partner");
  const mandatarios = withEmail
    .filter((p) => /^mandatario(_\d+)?$/.test(p.role))
    .sort((a, b) => partyRoleSortKey(a.role)[1] - partyRoleSortKey(b.role)[1]);
  const intermediarios = withEmail
    .filter((p) => /^intermediario_\d+$/.test(p.role))
    .sort((a, b) => partyRoleSortKey(a.role)[1] - partyRoleSortKey(b.role)[1]);

  const lines: string[] = [
    "<p>As Introduções de Clientes Introduzidos e Oportunidades, bem como a troca de Informações Confidenciais, serão formalizadas por Meios Eletrônicos, preferencialmente e-mail, enviados para os endereços eletrônicos oficiais das Partes:</p>",
    `<p>Head V3 Partners: ${esc(head)}, c/c para:</p>`,
  ];

  const blocoA = [`a.1) V3 Partners: ${esc(V3_FIXED_EMAIL)};`];
  if (partner) blocoA.push(`a.2) Parceiro V3 Partner: ${esc(partner.email!)};`);
  lines.push(`<p>${blocoA.join("<br/>")}</p>`);

  // Bloco 2: destinatário principal = 1º Mandatário; se não houver nenhum,
  // promove o 1º Intermediário (nunca deixa um "c/c" sem endereço principal).
  const bloco2Principal = mandatarios[0] ?? intermediarios[0];
  if (bloco2Principal) {
    const restantes = [...mandatarios.slice(mandatarios[0] ? 1 : 0), ...(mandatarios[0] ? intermediarios : intermediarios.slice(1))];
    const rotuloPrincipal = mandatarios[0] ? "MANDATÁRIO" : "INTERMEDIÁRIO(A) 1 (PARTNER V3)";
    if (restantes.length > 0) {
      lines.push(`<p>${rotuloPrincipal}: ${esc(bloco2Principal.email!)}; c/c para:</p>`);
      lines.push(
        `<p>${restantes
          .map((p, i) => `b.${i + 1}) INTERMEDIÁRIO(A) ${mandatarios[0] ? i + 1 : i + 2}: ${esc(p.email!)};`)
          .join("<br/>")}</p>`,
      );
    } else {
      lines.push(`<p>${rotuloPrincipal}: ${esc(bloco2Principal.email!)}.</p>`);
    }
  }

  lines.push(
    "<p>Os e-mails oficiais das demais Partes são os informados na qualificação civil de cada uma, constante do preâmbulo deste Instrumento.</p>",
  );
  return lines.join("\n\n");
}

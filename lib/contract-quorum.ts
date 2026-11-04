// Regra única de quórum da Revisão Jurídica de minutas (contract_templates).
//
// Fonte única da regra e dos 3 sócios votantes. Quem usa: a rota de revisão
// (POST/GET /api/contracts/templates/[id]/review) e a rota de edição
// (PATCH /api/contracts/templates/[id]). A tela NÃO importa valores deste
// arquivo (só `import type`): ela recebe o quórum já calculado pelo GET, para
// que os ids dos sócios nunca entrem no bundle do navegador.
//
// Regra (atualizada em 29/09/2026, saída do jurídico interno):
//   a) unanimidade (3 de 3 sócios) sempre fecha quórum;
//   b) maioria (2 de 3) fecha só se o valor declarado não passa de R$50 mil
//      (ou não foi declarado);
//   c) valor acima de R$50 mil sem unanimidade NÃO fecha.
// Voto de rodada anterior nunca conta: a rodada avança quando o texto muda
// (P0 de 04/09/2026), e o chamador passa aqui só os votos da rodada atual.

export const SOCIOS: ReadonlyArray<{ id: string; nome: string }> = [
  { id: "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", nome: "Robson Lino" },
  { id: "d0af8eaa-9f3c-4e7a-b8c6-613736524317", nome: "João Lemos" },
  // Hamilton tem 2 contas: 27a8a72e... (hamilton@, PARTNER_PRO, demonstração)
  // e 75c6cac4... (suporte@, ADMIN, conta real dele). Vale a real.
  { id: "75c6cac4-8d30-436e-b9a6-d5d494d7470b", nome: "Hamilton Santos" },
];

export const VALOR_LIMITE_MAIORIA = 50000;

export interface QuorumVote {
  reviewer_id: string;
  reviewer_type: string;
  decision: string;
}

export interface QuorumResult {
  /** Rodada a que o placar se refere. */
  rodada: number;
  /** Quantos sócios aprovaram na rodada (contagem igual à do backend). */
  sociosAprovaram: number;
  /** Nomes completos de quem aprovou, ordem alfabética pt-BR. */
  aprovaram: string[];
  /** Nomes completos de quem votou (aprovou ou reprovou), ordem alfabética pt-BR. */
  votaram: string[];
  /** Nomes completos de quem ainda não votou nesta rodada, ordem alfabética pt-BR. */
  faltam: string[];
  unanimidade: boolean;
  valorAcimaDoLimite: boolean;
  /** Quórum fechado. */
  met: boolean;
  /** Maioria atingida, mas o valor declarado exige unanimidade. */
  bloqueadoPorValor: boolean;
  /** Frase da regra de fechamento, igual na tela e na API. */
  regra: string;
  /** Mensagem de estado, idêntica à devolvida pela rota de revisão. */
  mensagem: string;
}

const ordenaNomes = (nomes: string[]) => [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));

export function computeQuorum(
  votosDaRodada: QuorumVote[],
  valorDeclarado: number | null | undefined,
  rodada: number
): QuorumResult {
  const aprovados = votosDaRodada.filter((v) => v.reviewer_type === "compliance_socio" && v.decision === "aprovado");
  const sociosAprovaram = aprovados.length;
  const valorAcimaDoLimite = typeof valorDeclarado === "number" && valorDeclarado > VALOR_LIMITE_MAIORIA;
  const unanimidade = sociosAprovaram >= 3;
  const maioria = sociosAprovaram >= 2;
  const met = unanimidade || (maioria && !valorAcimaDoLimite);
  const bloqueadoPorValor = valorAcimaDoLimite && maioria && !unanimidade;

  const aprovadosIds = new Set(aprovados.map((v) => v.reviewer_id));
  // "Votou" = qualquer voto de qualquer tipo da rodada, como o backend faz
  // (jaVotaram) para decidir quem ainda recebe o aviso de voto pendente.
  const votaramIds = new Set(votosDaRodada.map((v) => v.reviewer_id));

  const aprovaram = ordenaNomes(SOCIOS.filter((s) => aprovadosIds.has(s.id)).map((s) => s.nome));
  const votaram = ordenaNomes(SOCIOS.filter((s) => votaramIds.has(s.id)).map((s) => s.nome));
  const faltam = ordenaNomes(SOCIOS.filter((s) => !votaramIds.has(s.id)).map((s) => s.nome));

  const regra = valorAcimaDoLimite
    ? "Valor declarado acima de R$50 mil: só fecha com os 3 sócios."
    : "Fecha com 2 sócios (ou com os 3).";

  const mensagem = met
    ? unanimidade
      ? "Quórum atingido por unanimidade dos 3 sócios. Minuta aprovada, liberada para gerar contrato."
      : `Quórum atingido por maioria de sócios (${sociosAprovaram}/3). Minuta aprovada, liberada para gerar contrato.`
    : bloqueadoPorValor
      ? `Maioria de sócios atingida (${sociosAprovaram}/3), mas o valor declarado da operação (R$${valorDeclarado?.toLocaleString("pt-BR")}) passa de R$50.000: precisa da unanimidade dos 3 sócios. Aguardando.`
      : `Aprovação de sócio diretor registrada (${sociosAprovaram}/3 sócios). Aguardando 2 sócios${valorAcimaDoLimite ? " (ou os 3 sócios, dado o valor acima de R$50 mil)" : ""}.`;

  return { rodada, sociosAprovaram, aprovaram, votaram, faltam, unanimidade, valorAcimaDoLimite, met, bloqueadoPorValor, regra, mensagem };
}

// ---------------------------------------------------------------------------
// Edição de texto durante a revisão
// ---------------------------------------------------------------------------

/** Normaliza quebra de linha e espaços nas pontas, para comparar texto sem falso positivo. */
export function normalizeBody(s: string | null | undefined): string {
  return (s ?? "").replace(/\r\n?/g, "\n").trim();
}

/**
 * O revisor mudou de fato o texto? A tela sempre manda o conteúdo do campo
 * junto do voto, então só diferença real de conteúdo conta (CRLF, espaço no
 * fim ou linha em branco extra não reiniciam a votação).
 */
export function isBodyEdited(incoming: unknown, current: string | null | undefined): boolean {
  if (typeof incoming !== "string" || !incoming.trim()) return false;
  return normalizeBody(incoming) !== normalizeBody(current);
}

/**
 * Sócios que aprovaram a rodada anterior e devem ser avisados de que a
 * votação recomeçou. Exclui quem fez a edição. Só ids dos 3 sócios.
 */
export function roundRestartRecipients(votosRodadaAnterior: QuorumVote[], editorId: string | null | undefined): string[] {
  const socios = new Set(SOCIOS.map((s) => s.id));
  const ids = votosRodadaAnterior
    .filter((v) => v.reviewer_type === "compliance_socio" && v.decision === "aprovado" && socios.has(v.reviewer_id))
    .map((v) => v.reviewer_id)
    .filter((id) => id !== editorId);
  return Array.from(new Set(ids));
}

/** Texto genérico: sem nome de minuta, cliente, deal ou valor. */
export function roundRestartNotification(templateId: string) {
  return {
    title: "Minuta alterada durante a revisão",
    message: "O texto mudou e a votação desta minuta recomeçou. Abra no link e vote de novo.",
    type: "minuta_rodada_reiniciada",
    actionUrl: `https://app.v3partners.com.br/juridico/contratos?tab=minutas&template_id=${templateId}`,
  };
}

type Notifier = (p: { userId: string; title: string; message: string; type: string; actionUrl?: string }) => Promise<void>;

/**
 * Avisa os sócios que haviam aprovado a rodada anterior. Notificador injetado
 * (teste usa stub). Best-effort: falha de um aviso nunca derruba o fluxo, e a
 * função só termina depois de todos os envios (Vercel mata promessa solta).
 */
export async function notifyRoundRestart(params: {
  templateId: string;
  votosRodadaAnterior: QuorumVote[];
  editorId: string | null | undefined;
  notify: Notifier;
}): Promise<string[]> {
  const destinatarios = roundRestartRecipients(params.votosRodadaAnterior, params.editorId);
  const conteudo = roundRestartNotification(params.templateId);
  await Promise.all(
    destinatarios.map((userId) =>
      params.notify({ userId, ...conteudo }).catch((e) => console.error("[contract-quorum] aviso de rodada reiniciada falhou:", userId, e))
    )
  );
  return destinatarios;
}

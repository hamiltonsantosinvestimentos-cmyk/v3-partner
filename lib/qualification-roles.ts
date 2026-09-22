import { buildLegalQualification } from "./legal-qualification";

// Rótulos de role_in_document (cm_party_qualifications), compartilhados entre
// telas client (contracts-panel-client.tsx, qualification-batches-panel.tsx)
// e rotas server (api/cm/qualifications/legal-text). Extraído em 13/08/2026
// (Fase 2) para não duplicar o dicionário num componente "use client" e
// evitar puxar dependências de UI para dentro de uma rota de API.
export const ROLE_LABELS: Record<string, string> = {
  parte_principal: "Parte Principal",
  intermediario_finder_venda: "Intermediário/Finder Venda",
  intermediario_finder_compra: "Intermediário/Finder Compra",
  mandatario: "Mandatário",
  testemunha: "Testemunha",
  // Papéis granulares da indicação rápida (13/08/2026, Fase 1) — ver
  // 20260813_qualificacoes_pf_pj_fpa.sql.
  finder_originacao_venda: "Finder/Originação Venda",
  finder_originacao_compra: "Finder/Originação Compra",
  intermediario_venda: "Intermediário Venda",
  intermediario_compra: "Intermediário Compra",
  // Papéis do NCNDA Mestre e instrumentos com múltiplas partes numeradas do
  // mesmo tipo (03/09/2026, achado ao vivo com João e Dr. Athaydes testando
  // "Gerar Contrato" real: o dropdown não cobria o desenho de partes do
  // próprio modelo do Dr. Luis). Cada papel numerado precisa de um
  // role_in_document distinto porque o motor de variáveis resolve
  // {{<role_in_document>_nome}}/_cpf_cnpj/_rg/_endereco/_email por papel
  // (app/api/contracts/generate/route.ts) -- "mandatário 1" e "mandatário
  // 2" nunca podem compartilhar o mesmo papel, ou a segunda pessoa
  // sobrescreveria a primeira no corpo do contrato.
  estruturador: "Estruturador",
  head_mesa: "Head da Mesa",
  partner: "Partner",
  mandatario_1: "Mandatário 1",
  mandatario_2: "Mandatário 2",
  // Ampliado de 2 para 10 (11/09/2026, pedido de João: operações reais do
  // NCNDA Mestre têm mais de 2 intermediários simultâneos). O motor de
  // prosa (party_qualifications_block) já é dinâmico por parte, não por
  // slot fixo -- o cap de 2 era só deste dicionário + do CHECK constraint
  // do banco, nunca do template em si (nenhuma das 3 minutas reais que
  // usam papel numerado referencia {{intermediario_N_nome}} direto no
  // corpo, todas usam o bloco automático). Ver migration
  // 20260911c_qualificacoes_intermediarios_ate_10.sql.
  intermediario_1: "Intermediário 1",
  intermediario_2: "Intermediário 2",
  intermediario_3: "Intermediário 3",
  intermediario_4: "Intermediário 4",
  intermediario_5: "Intermediário 5",
  intermediario_6: "Intermediário 6",
  intermediario_7: "Intermediário 7",
  intermediario_8: "Intermediário 8",
  intermediario_9: "Intermediário 9",
  intermediario_10: "Intermediário 10",
};

export interface QualificationPartyForProse {
  role_in_document: string;
  full_name: string;
  email?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  endereco_completo?: string | null;
  person_type?: "PF" | "PJ" | null;
  party_nature?: import("./legal-qualification").PartyNature | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_legal_nature?: import("./legal-qualification").CompanyLegalNature | null;
  nationality?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  representation?: import("./legal-qualification").LegalQualificationRepresentation | null;
}

// Motor de prosa unificado (01/09/2026, diretriz Dr. Athaydes): a lógica de
// qualificação civil em si (PF/PJ/Procuração/Incapaz/Espólio, recursiva
// para representação encadeada) mora em lib/legal-qualification.ts, fonte
// única compartilhada com app/api/cm/qualifications/legal-text/route.ts.
// Esta função só prefixa o papel no documento (mandatário, testemunha etc),
// mesmo formato usado desde sempre pelo NCNDA Mestre (lib/ncnda-desk-head.ts).
//
// displayLabel (21/09/2026, D2b): rótulo de exibição já renumerado por
// buildPartyDisplayLabels(). Sem ele, cai no rótulo de origem do papel.
export function renderPartyQualificationProse(party: QualificationPartyForProse, displayLabel?: string): string {
  const roleLabel = (displayLabel ?? ROLE_LABELS[party.role_in_document] ?? party.role_in_document).toUpperCase();
  return `${roleLabel}: ${buildLegalQualification(party)}`;
}

// ---------------------------------------------------------------------------
// Ordem canônica das partes do instrumento (21/09/2026, BRIEF NCNDA, D2).
//
// Achado real no NCNDA V3C-NDA-2026-0036: a leitura de cm_party_qualifications
// não tinha ORDER BY, então prosa e bloco de assinaturas saíam na ordem física
// do Postgres (nem a do preenchimento, nem a numérica). Ordem oficial aprovada
// por João: 1 Estruturador, 2 Head da Mesa, 3 Partner, 4 Mandatário,
// 5 Intermediários por número crescente. Papéis legados (finder, parte
// principal, testemunha) ganham posição fixa em vez de ordem arbitrária.
// ---------------------------------------------------------------------------
const ROLE_GROUP_ESTRUTURADOR = 0;
const ROLE_GROUP_HEAD = 1;
const ROLE_GROUP_PARTNER = 2;
const ROLE_GROUP_MANDATARIO = 3;
const ROLE_GROUP_INTERMEDIARIO = 4;
const ROLE_GROUP_INTERMEDIARIO_LEGADO = 5;
const ROLE_GROUP_OUTROS = 8;
const ROLE_GROUP_TESTEMUNHA = 9;

const LEGACY_INTERMEDIARY_ROLES = new Set([
  "intermediario_finder_venda",
  "intermediario_finder_compra",
  "finder_originacao_venda",
  "finder_originacao_compra",
  "intermediario_venda",
  "intermediario_compra",
]);

function roleNumericSuffix(role: string): number {
  const m = role.match(/_(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Par [grupo, número] que define a posição canônica de um papel. */
export function partyRoleSortKey(role: string): [number, number] {
  if (role === "estruturador" || role === "v3_partners") return [ROLE_GROUP_ESTRUTURADOR, 0];
  if (role === "head_mesa") return [ROLE_GROUP_HEAD, 0];
  if (role === "partner" || role === "parte_principal") return [ROLE_GROUP_PARTNER, 0];
  if (role === "mandatario" || /^mandatario_\d+$/.test(role)) return [ROLE_GROUP_MANDATARIO, roleNumericSuffix(role)];
  if (/^intermediario_\d+$/.test(role)) return [ROLE_GROUP_INTERMEDIARIO, roleNumericSuffix(role)];
  if (LEGACY_INTERMEDIARY_ROLES.has(role)) return [ROLE_GROUP_INTERMEDIARIO_LEGADO, 0];
  if (role === "testemunha") return [ROLE_GROUP_TESTEMUNHA, 0];
  return [ROLE_GROUP_OUTROS, 0];
}

/**
 * Ordenação determinística: grupo, número do papel e, por fim, o desempate
 * informado (data de criação e nome, no caso das qualificações). Nunca muta o
 * array recebido.
 */
export function sortPartiesByRole<T>(
  parties: readonly T[],
  roleOf: (p: T) => string,
  tieBreakOf?: (p: T) => string,
): T[] {
  return [...parties].sort((a, b) => {
    const [ga, na] = partyRoleSortKey(roleOf(a));
    const [gb, nb] = partyRoleSortKey(roleOf(b));
    if (ga !== gb) return ga - gb;
    if (na !== nb) return na - nb;
    const ta = tieBreakOf?.(a) ?? "";
    const tb = tieBreakOf?.(b) ?? "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

/** Ordena linhas de cm_party_qualifications pela ordem canônica. */
export function sortQualificationParties<T extends { role_in_document: string; created_at?: string | null; full_name?: string | null }>(
  parties: readonly T[],
): T[] {
  return sortPartiesByRole(parties, (p) => p.role_in_document, (p) => `${p.created_at ?? ""}|${p.full_name ?? ""}`);
}

/**
 * Rótulos de exibição (D2b, decisão de João para o Dr. Luiz): os
 * intermediários numerados são renumerados de 1 a N na ordem crescente do
 * papel, para o texto do instrumento ficar limpo e contínuo (sem parecer que
 * alguém foi ocultado quando o lote vai de 2 a 6). A chave do papel no banco
 * (role_in_document) NUNCA é renumerada: variáveis {{intermediario_N_nome}} e
 * a rastreabilidade ao formulário de qualificação seguem intactas. Só entram
 * no mapa os papéis cujo rótulo muda; os demais usam ROLE_LABELS.
 */
export function buildPartyDisplayLabels(roles: readonly string[]): Record<string, string> {
  const numbered = Array.from(new Set(roles.filter((r) => /^intermediario_\d+$/.test(r))))
    .sort((a, b) => roleNumericSuffix(a) - roleNumericSuffix(b));
  const labels: Record<string, string> = {};
  numbered.forEach((role, i) => {
    const display = `Intermediário ${i + 1}`;
    if (display !== ROLE_LABELS[role]) labels[role] = display;
  });
  return labels;
}

/**
 * Desduplica signatários pelo e-mail normalizado (minúsculas, sem espaços).
 * A primeira ocorrência vence; e-mail vazio nunca desduplica (o gate de
 * integridade de send/route.ts trata parte sem e-mail à parte). Achado real
 * em V3C-NDA-2026-0036: Head da Mesa entrava duas vezes com o mesmo e-mail
 * (uma vez pelo lote de qualificação, outra pelo perfil do Head).
 */
export function dedupePartiesByEmail<T extends { email?: string | null }>(parties: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of parties) {
    const key = (p.email ?? "").trim().toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(p);
  }
  return out;
}

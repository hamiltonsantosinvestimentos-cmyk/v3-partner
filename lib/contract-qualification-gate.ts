/**
 * Gate de envio da conferência da qualificação (BRIEF 11/11/2026, seção 4.5).
 *
 * Só a rota `send` chama. A troca de e-mail em contrato já enviado (`change-signer-email`) não passa
 * por aqui, de propósito: ela cancela o envelope e reenvia, e um contrato legado com defeito de
 * qualificação (o 0051 foi enviado com "brasil" na nacionalidade) não pode ficar sem como corrigir
 * um e-mail errado. As regras novas valem no envio pela rota `send`.
 *
 * Override: só o Q-02 admite, só o ADMIN, com justificativa de 10 a 500 caracteres sem CPF nem
 * CNPJ. Q-01, Q-04, Q-05 e Q-07 nunca admitem. A gravação do override em audit_logs é feita pela
 * rota, com await e antes do envio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Q_OVERRIDE_PERMITIDO,
  bloqueiosSemOverride,
  conferirQualificacao,
  type QFinding,
  type QRuleId,
} from "./contract-qualification-check";
import { loadQualificationParties, type ContractPartyLite } from "./contract-qualification-load";
import { Q01_DATA_DE_CORTE_ISO, Q08_DATA_DE_CORTE_ISO } from "./qualification-gate";
import { ROLE_LABELS } from "./qualification-roles";
import { normalizeDocument } from "./v3-clients-pure";

export const JUSTIFICATIVA_MIN = 10;
export const JUSTIFICATIVA_MAX = 500;

export interface QualificationGateContract {
  qualification_batch_id?: string | null;
  parties?: ContractPartyLite[] | null;
  rendered_html?: string | null;
  created_at?: string | null;
}

export interface QualificationGateOpts {
  role: string;
  justificativa?: string | null;
}

export type QualificationGateResult =
  | { ok: true; overridden: QRuleId[]; findings: QFinding[] }
  | { ok: false; status: 403 | 422 | 500; error: string; findings: QFinding[]; podeOverride: boolean };

/** CPF ou CNPJ digitado em texto livre (com ou sem pontuação). */
export function justificativaTemDocumento(texto: string): boolean {
  return /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(texto) || /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(texto);
}

function resumo(findings: QFinding[]): string {
  const vistos = new Set<string>();
  const partes: string[] = [];
  for (const f of findings) {
    const chave = `${f.id}|${f.role}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    partes.push(`${f.id} (${f.role}): ${f.message.replace(/^Q-\d+:\s*/, "")}`);
  }
  return partes.join(" ");
}

/** Decisão pura, sem banco: dado o resultado da conferência e quem está enviando, pode enviar? */
export function decidirGateDeQualificacao(findings: QFinding[], opts: QualificationGateOpts): QualificationGateResult {
  const bloqueios = findings.filter((f) => f.severity === "bloqueia");
  if (bloqueios.length === 0) return { ok: true, overridden: [], findings };

  const semOverride = bloqueiosSemOverride(findings);
  const prefixo = `Contrato não pode ser enviado: a conferência da qualificação encontrou ${bloqueios.length} bloqueio(s). `;

  if (semOverride.length > 0) {
    return {
      ok: false,
      status: 422,
      error: `${prefixo}${resumo(bloqueios)} Corrija a qualificação pelo link ("Reabrir para Correção"), sem editar o dado.`,
      findings,
      podeOverride: false,
    };
  }

  // Só há bloqueios que admitem override (hoje, só o Q-02).
  const justificativa = (opts.justificativa ?? "").trim();
  if (!justificativa) {
    return {
      ok: false,
      status: 422,
      error: `${prefixo}${resumo(bloqueios)} Corrija a qualificação ou, se o documento original confirmar o dado, o ADMIN pode enviar mesmo assim com justificativa.`,
      findings,
      podeOverride: opts.role === "ADMIN",
    };
  }
  if (opts.role !== "ADMIN") {
    return { ok: false, status: 403, error: "Só o ADMIN pode enviar mesmo assim.", findings, podeOverride: false };
  }
  if (justificativa.length < JUSTIFICATIVA_MIN || justificativa.length > JUSTIFICATIVA_MAX) {
    return {
      ok: false,
      status: 422,
      error: `A justificativa precisa ter de ${JUSTIFICATIVA_MIN} a ${JUSTIFICATIVA_MAX} caracteres.`,
      findings,
      podeOverride: true,
    };
  }
  if (justificativaTemDocumento(justificativa)) {
    return {
      ok: false,
      status: 422,
      error: "A justificativa não pode conter CPF nem CNPJ. Descreva o motivo sem o número do documento.",
      findings,
      podeOverride: true,
    };
  }
  const regras = Array.from(new Set(bloqueios.map((b) => b.id))).filter((id) => Q_OVERRIDE_PERMITIDO.includes(id));
  return { ok: true, overridden: regras, findings };
}

export interface LinhaQ08 {
  role_in_document: string;
  status: string;
  filled_at: string | null;
  conferida_em: string | null;
}

/** Q-08 (pura): partes preenchidas a partir do corte que ainda não foram conferidas. Nunca admite override. */
export function q08NaoConferidas(linhas: LinhaQ08[], corteIso: string | null): string[] {
  if (!corteIso) return [];
  const corte = Date.parse(corteIso);
  if (!Number.isFinite(corte)) return [];
  const papeis: string[] = [];
  for (const l of linhas) {
    if (l.status !== "preenchido" || !l.filled_at) continue;
    if (Date.parse(l.filled_at) < corte) continue;
    if (l.conferida_em) continue;
    const papel = ROLE_LABELS[l.role_in_document] ?? l.role_in_document;
    if (!papeis.includes(papel)) papeis.push(papel);
  }
  return papeis;
}

/** Lê a qualificação do contrato, confere Q-01 a Q-08 e decide. Falha fechada se não conseguir ler. */
export async function checkQualificationGate(
  db: SupabaseClient,
  contract: QualificationGateContract,
  opts: QualificationGateOpts,
): Promise<QualificationGateResult> {
  const loaded = await loadQualificationParties(db, contract);
  if (!loaded.ok) return { ok: false, status: 500, error: loaded.error, findings: [], podeOverride: false };

  const head = loaded.parties.find((p) => p.role === "head_mesa");
  const headDoc = head ? normalizeDocument(head.cpfCnpj) : "";
  const findings = conferirQualificacao(loaded.parties, {
    renderedHtml: contract.rendered_html ?? null,
    createdAt: contract.created_at ?? null,
    cutoffIso: Q01_DATA_DE_CORTE_ISO,
    // O Head pode também ser representante de uma parte: o mesmo CPF dele não conta como duplicidade.
    documentosPermitidosEmDuplicidade: headDoc ? [headDoc] : [],
  });
  const decisao = decidirGateDeQualificacao(findings, opts);

  // Q-08: toda parte preenchida depois do corte precisa estar conferida. Falha fechada se não conseguir ler.
  // Não admite override (nem do ADMIN): a conferência é a prova de que uma pessoa comparou com o documento.
  if (contract.qualification_batch_id && Q08_DATA_DE_CORTE_ISO) {
    const { data: linhas, error: q08Err } = await db
      .from("cm_party_qualifications")
      .select("role_in_document, status, filled_at, conferida_em")
      .eq("batch_id", contract.qualification_batch_id)
      .is("deleted_at", null);
    if (q08Err) {
      return { ok: false, status: 500, error: "Falha ao ler a conferência da qualificação para o envio.", findings, podeOverride: false };
    }
    const faltam = q08NaoConferidas((linhas ?? []) as LinhaQ08[], Q08_DATA_DE_CORTE_ISO);
    if (faltam.length > 0) {
      return {
        ok: false,
        status: 422,
        error: `Qualificação de ${faltam.join(", ")} ainda não conferida. Abra a ficha e conclua a conferência.`,
        findings,
        podeOverride: false,
      };
    }
  }
  return decisao;
}

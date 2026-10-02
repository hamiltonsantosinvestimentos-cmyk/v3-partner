// Auditoria de acessos a dado sensível (Compliance, só ADMIN). Une as 3 tabelas de log existentes,
// sem migration de dados: revelações de campo, aberturas de documento e apagamentos de log.
// IP SEMPRE mascarado. O valor revelado nunca aparece. O motivo (texto livre) do apagamento
// não é exibido, só a categoria e a quantidade (pode conter dado pessoal).
import type { SupabaseClient } from "@supabase/supabase-js";
import { labelRevealField, maskIp } from "@/lib/qualification-mask";
import { KYC_DOCUMENT_KIND_LABELS } from "@/lib/kyc-documents";

export const AUDIT_EVENT_TYPES = ["todos", "campo", "documento", "apagamento"] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditFilters = { from?: string; to?: string; user?: string; party?: string; type: AuditEventType };
export type AuditItem = {
  id: string; source: "campo" | "documento" | "apagamento"; at: string;
  user_id: string | null; user_name: string; qualification_id: string | null; party_name: string;
  what: string; ip_masked: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ERASE_SOURCE_LABELS: Record<string, string> = { field_views: "revelações de campo", document_views: "aberturas de documento" };

/** Valida os parâmetros no servidor. Período no fuso de São Paulo (UTC-3, sem horário de verão), convertido para ISO. */
export function parseFilters(sp: URLSearchParams): { ok: true; f: AuditFilters; fromIso?: string; toIso?: string } | { ok: false; error: string } {
  const type = (sp.get("type") ?? "todos") as AuditEventType;
  if (!AUDIT_EVENT_TYPES.includes(type)) return { ok: false, error: "Tipo de evento inválido" };
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;
  const user = sp.get("user") || undefined;
  const party = (sp.get("party") || "").trim().slice(0, 80) || undefined;
  if (from && (!DATE.test(from) || Number.isNaN(Date.parse(`${from}T00:00:00-03:00`)))) return { ok: false, error: "Data inicial inválida" };
  if (to && (!DATE.test(to) || Number.isNaN(Date.parse(`${to}T23:59:59-03:00`)))) return { ok: false, error: "Data final inválida" };
  if (user && !UUID.test(user)) return { ok: false, error: "Usuário inválido" };
  return {
    ok: true,
    f: { from, to, user, party, type },
    fromIso: from ? new Date(`${from}T00:00:00-03:00`).toISOString() : undefined,
    toIso: to ? new Date(`${to}T23:59:59.999-03:00`).toISOString() : undefined,
  };
}

export type Cursor = { at: string; id: string } | null;
export function parseCursor(raw: string | null): Cursor {
  if (!raw) return null;
  const [at, id] = raw.split("|");
  if (!at || !id || !UUID.test(id) || Number.isNaN(Date.parse(at))) return null;
  return { at, id };
}

type Row = Record<string, any>;

async function resolvePartyIds(db: SupabaseClient, party?: string): Promise<string[] | null> {
  if (!party) return null;
  const safe = party.replace(/[%_,()]/g, " ");
  const { data } = await db.from("cm_party_qualifications").select("id").ilike("full_name", `%${safe}%`).limit(200);
  return (data ?? []).map((r) => r.id as string);
}

/** Uma página mesclada (mais recente primeiro, desempate por id), com `limit` itens e o cursor da próxima. */
export async function fetchAuditPage(
  db: SupabaseClient, filters: AuditFilters, fromIso: string | undefined, toIso: string | undefined,
  cursor: Cursor, limit: number,
): Promise<{ items: AuditItem[]; next: string | null }> {
  const partyIds = await resolvePartyIds(db, filters.party);
  if (partyIds && partyIds.length === 0) return { items: [], next: null };

  const take = limit + 1;
  const apply = (q: any, dateCol: string, userCol: string, hasParty: boolean) => {
    if (fromIso) q = q.gte(dateCol, fromIso);
    if (toIso) q = q.lte(dateCol, toIso);
    if (filters.user) q = q.eq(userCol, filters.user);
    if (partyIds && hasParty) q = q.in("qualification_id", partyIds);
    if (cursor) q = q.or(`${dateCol}.lt.${cursor.at},and(${dateCol}.eq.${cursor.at},id.lt.${cursor.id})`);
    return q.order(dateCol, { ascending: false }).order("id", { ascending: false }).limit(take);
  };

  const wants = (t: AuditEventType) => filters.type === "todos" || filters.type === t;
  const [fv, dv, er] = await Promise.all([
    wants("campo") ? apply(db.from("cm_party_qualification_field_views").select("id, field, viewed_by, viewed_at, ip, qualification_id"), "viewed_at", "viewed_by", true) : { data: [] },
    wants("documento") ? apply(db.from("cm_party_qualification_document_views").select("id, document_id, viewed_by, viewed_at, ip_address, qualification_id"), "viewed_at", "viewed_by", true) : { data: [] },
    wants("apagamento") ? apply(db.from("cm_party_qualification_log_erasures").select("id, executed_by, executed_at, source_table, qualification_id, deleted_count"), "executed_at", "executed_by", true) : { data: [] },
  ]);
  for (const r of [fv, dv, er] as { error?: unknown }[]) if (r.error) throw new Error("Falha ao consultar os logs");

  const docIds = [...new Set(((dv.data ?? []) as Row[]).map((r) => r.document_id).filter(Boolean))] as string[];
  const kinds = new Map<string, string>();
  if (docIds.length) {
    const { data } = await db.from("cm_party_qualification_documents").select("id, document_kind").in("id", docIds);
    for (const d of data ?? []) kinds.set(d.id as string, d.document_kind as string);
  }

  const merged: (Omit<AuditItem, "user_name" | "party_name"> & { _u: string | null })[] = [
    ...((fv.data ?? []) as Row[]).map((r) => ({ id: r.id, source: "campo" as const, at: r.viewed_at, _u: r.viewed_by, user_id: r.viewed_by, qualification_id: r.qualification_id, what: labelRevealField(r.field), ip_masked: maskIp(r.ip) })),
    ...((dv.data ?? []) as Row[]).map((r) => {
      const k = r.document_id ? kinds.get(r.document_id) : null;
      const label = k ? (KYC_DOCUMENT_KIND_LABELS[k as keyof typeof KYC_DOCUMENT_KIND_LABELS] ?? k) : null;
      return { id: r.id, source: "documento" as const, at: r.viewed_at, _u: r.viewed_by, user_id: r.viewed_by, qualification_id: r.qualification_id, what: label ? `${label} aberto` : "Documento removido", ip_masked: maskIp(r.ip_address) };
    }),
    ...((er.data ?? []) as Row[]).map((r) => ({ id: r.id, source: "apagamento" as const, at: r.executed_at, _u: r.executed_by, user_id: r.executed_by, qualification_id: r.qualification_id, what: `Apagamento de ${r.deleted_count} registro(s) de ${ERASE_SOURCE_LABELS[r.source_table] ?? "log"}`, ip_masked: "não se aplica" })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1));

  const page = merged.slice(0, limit);
  const hasMore = merged.length > limit;

  const uids = [...new Set(page.map((r) => r._u).filter(Boolean))] as string[];
  const qids = [...new Set(page.map((r) => r.qualification_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  const parties = new Map<string, string>();
  if (uids.length) for (const p of (await db.from("profiles").select("id, full_name").in("id", uids)).data ?? []) names.set(p.id as string, (p.full_name as string) || "Usuário");
  if (qids.length) for (const q of (await db.from("cm_party_qualifications").select("id, full_name").in("id", qids)).data ?? []) parties.set(q.id as string, q.full_name as string);

  const items: AuditItem[] = page.map(({ _u, ...r }) => ({
    ...r,
    user_name: _u ? names.get(_u) ?? "Usuário removido" : "Sistema",
    party_name: r.qualification_id ? parties.get(r.qualification_id) ?? "Parte removida" : "Todas (retenção automática)",
  }));
  const last = page[page.length - 1];
  return { items, next: hasMore && last ? `${last.at}|${last.id}` : null };
}

/** Resumo: acessos hoje, 7 e 30 dias (fuso de São Paulo), usuários distintos e top 5. */
export async function fetchSummary(db: SupabaseClient) {
  const now = new Date();
  const spDay = new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const startToday = new Date(`${spDay}T00:00:00-03:00`);
  const d7 = new Date(startToday.getTime() - 6 * 86400000);
  const d30 = new Date(startToday.getTime() - 29 * 86400000);

  const read = async (table: string, col: string, userCol: string) => {
    const { data } = await db.from(table).select(`${col}, ${userCol}`).gte(col, d30.toISOString()).limit(5000);
    return (data ?? []) as unknown as Row[];
  };
  const [fv, dv] = await Promise.all([
    read("cm_party_qualification_field_views", "viewed_at", "viewed_by"),
    read("cm_party_qualification_document_views", "viewed_at", "viewed_by"),
  ]);
  const rows = [...fv.map((r) => ({ at: new Date(r.viewed_at), u: r.viewed_by as string | null })), ...dv.map((r) => ({ at: new Date(r.viewed_at), u: r.viewed_by as string | null }))];
  const count = (since: Date) => rows.filter((r) => r.at >= since).length;

  const perUser = new Map<string, number>();
  for (const r of rows) if (r.u) perUser.set(r.u, (perUser.get(r.u) ?? 0) + 1);
  const ids = [...perUser.keys()];
  const names = new Map<string, string>();
  if (ids.length) for (const p of (await db.from("profiles").select("id, full_name").in("id", ids)).data ?? []) names.set(p.id as string, (p.full_name as string) || "Usuário");
  const users = ids.map((id) => ({ id, name: names.get(id) ?? "Usuário" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const top = [...perUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ name: names.get(id) ?? "Usuário", count: n }));

  return { today: count(startToday), days7: count(d7), days30: rows.length, distinct_users: perUser.size, top, users };
}

/** Célula de CSV segura: prefixa apóstrofo contra injeção de fórmula e escapa aspas. */
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

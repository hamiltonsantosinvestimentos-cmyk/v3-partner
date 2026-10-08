import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { hasDueDiligenceAccess } from "@/lib/cm/dd-access";
import { runDdTool, DD_TOOLS_ORDER, type DdTool } from "@/lib/cm/dd-tools";
import { detectDocument } from "@/lib/document-check";

// Aba Due Diligence da Ficha de Qualificacao, Entrega 1 (08/10/2026).
// GET: historico da parte + consultas recentes (menos de 60 dias) do mesmo documento.
// POST: executa UMA consulta. O registro em cm_party_dd_runs e gravado com await ANTES da resposta
// (nunca `void db...insert()`: o builder do supabase-js nao envia sem await).
// Gate: user_feature_access (due_diligence_qualificacao), por usuario, sem bypass para ADMIN.
// Entrega 1: so parte PJ (CNPJ). Parte PF fica desabilitada ate o parecer de compliance.
// Nenhuma resposta traz nome ou CPF de socio.

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const RECENT_DAYS = 60;

type PartyDoc =
  | { ok: true; kind: "cpf" | "cnpj"; value: string }
  | { ok: false; reason: string };

function resolveDocument(row: { person_type: string | null; cpf_cnpj: string | null; company_cnpj: string | null }): PartyDoc {
  const raw = row.person_type === "PJ" ? row.company_cnpj : row.cpf_cnpj;
  if (!raw || !raw.trim()) return { ok: false, reason: "Parte sem CPF ou CNPJ informado (parte estrangeira ou cadastro incompleto)" };
  const d = detectDocument(raw);
  if (!d) return { ok: false, reason: "Documento da parte inválido: a consulta não foi liberada" };
  return { ok: true, kind: d.kind, value: d.value };
}

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  if (!(await hasDueDiligenceAccess(user.id))) {
    return { error: NextResponse.json({ error: "Sem permissão para Due Diligence" }, { status: 403, headers: NO_STORE }) };
  }
  return { userId: user.id };
}

async function loadParty(db: ReturnType<typeof svc>, id: string) {
  const { data: row } = await db
    .from("cm_party_qualifications")
    .select("id, status, deleted_at, person_type, cpf_cnpj, company_cnpj, batch_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.deleted_at) return null;
  return row;
}

/**
 * Numero do contrato ligado ao lote da parte. Nos NCNDA o lote e "consumido" pelo contrato
 * (consumido_por_contract_id) e operation_contract_id fica vazio; por isso olhamos os tres
 * vinculos e damos preferencia ao contrato de serie NCNDA (V3C-NDA), que e o que origina a due diligence.
 */
async function resolveContractCode(db: ReturnType<typeof svc>, batchId: string | null): Promise<string | null> {
  if (!batchId) return null;
  const { data: batch } = await db
    .from("cm_qualification_batches")
    .select("operation_contract_id, consumido_por_contract_id, parent_contract_id")
    .eq("id", batchId)
    .maybeSingle();
  const ids = [batch?.operation_contract_id, batch?.consumido_por_contract_id, batch?.parent_contract_id].filter(Boolean) as string[];
  if (ids.length === 0) return null;
  const { data: contracts } = await db.from("operation_contracts").select("id, contract_code").in("id", ids);
  const byId = new Map((contracts ?? []).map((c) => [c.id as string, (c.contract_code as string | null) ?? null]));
  const codes = ids.map((id) => byId.get(id)).filter(Boolean) as string[];
  return codes.find((c) => c.startsWith("V3C-NDA")) ?? codes[0] ?? null;
}

async function namesByUserId(db: ReturnType<typeof svc>, ids: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids));
  if (uniq.length === 0) return {};
  const { data } = await db.from("profiles").select("id, full_name").in("id", uniq);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Usuário"]));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const db = svc();

  const party = await loadParty(db, id);
  if (!party) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });

  const doc = resolveDocument(party);
  const contractCode = await resolveContractCode(db, party.batch_id as string | null);

  const { data: runs } = await db
    .from("cm_party_dd_runs")
    .select("id, tool, status, result_summary, contract_code, reuse_reason, requested_by, created_at")
    .eq("party_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  let recent: unknown[] = [];
  if (doc.ok) {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: rec } = await db
      .from("cm_party_dd_runs")
      .select("id, tool, status, result_summary, contract_code, created_at")
      .eq("document_value", doc.value)
      .in("status", ["ok", "sem_dados"])
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    // Uma entrada por ferramenta: a mais recente.
    const seen = new Set<string>();
    recent = (rec ?? []).filter((r) => (seen.has(r.tool as string) ? false : (seen.add(r.tool as string), true)));
  }

  const names = await namesByUserId(db, (runs ?? []).map((r) => r.requested_by as string));
  return NextResponse.json(
    {
      access: true,
      document: doc.ok ? { kind: doc.kind, available: doc.kind === "cnpj" } : { kind: null, available: false, reason: doc.reason },
      pf_blocked_reason: doc.ok && doc.kind === "cpf" ? "Disponível após parecer de compliance" : null,
      contract_code: contractCode,
      tools: DD_TOOLS_ORDER,
      recent_days: RECENT_DAYS,
      recent,
      runs: (runs ?? []).map((r) => ({ ...r, requested_by_name: names[r.requested_by as string] ?? "Usuário", requested_by: undefined })),
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { tool?: unknown; force?: unknown; reason?: unknown };
  const tool = body.tool as DdTool;
  if (!DD_TOOLS_ORDER.includes(tool)) return NextResponse.json({ error: "Ferramenta inválida" }, { status: 422, headers: NO_STORE });

  const db = svc();
  const party = await loadParty(db, id);
  if (!party) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });
  if (party.status !== "preenchido") {
    return NextResponse.json({ error: "A parte ainda não preencheu a qualificação" }, { status: 409, headers: NO_STORE });
  }

  const doc = resolveDocument(party);
  if (!doc.ok) return NextResponse.json({ error: doc.reason }, { status: 422, headers: NO_STORE });
  if (doc.kind !== "cnpj") {
    return NextResponse.json({ error: "Disponível após parecer de compliance" }, { status: 422, headers: NO_STORE });
  }

  // Alerta de reaproveitamento: mesma ferramenta e mesmo documento com menos de 60 dias.
  const force = body.force === true;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!force) {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: prev } = await db
      .from("cm_party_dd_runs")
      .select("id, tool, status, result_summary, contract_code, created_at")
      .eq("document_value", doc.value)
      .eq("tool", tool)
      .in("status", ["ok", "sem_dados"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (prev && prev.length > 0) {
      return NextResponse.json({ error: "Consulta recente já existe", recent: prev[0] }, { status: 409, headers: NO_STORE });
    }
  } else if (reason.length < 10) {
    return NextResponse.json({ error: "Informe o motivo da nova consulta (mínimo de 10 caracteres)" }, { status: 422, headers: NO_STORE });
  }

  const contractCode = await resolveContractCode(db, party.batch_id as string | null);
  const outcome = await runDdTool(tool, doc.value);

  const { data: saved, error: insertError } = await db
    .from("cm_party_dd_runs")
    .insert({
      party_id: id,
      contract_code: contractCode,
      tool,
      document_value: doc.value,
      document_kind: doc.kind,
      status: outcome.status,
      result_summary: outcome.summary,
      reuse_reason: force ? reason : null,
      requested_by: auth.userId,
    })
    .select("id, tool, status, result_summary, contract_code, reuse_reason, created_at")
    .single();
  if (insertError || !saved) {
    console.error("[due-diligence] falha ao gravar consulta", { party_id: id, tool, code: insertError?.code });
    return NextResponse.json({ error: "A consulta foi feita mas não pôde ser registrada, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const names = await namesByUserId(db, [auth.userId]);
  return NextResponse.json({ run: { ...saved, requested_by_name: names[auth.userId] ?? "Usuário" } }, { headers: NO_STORE });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { hasDueDiligenceAccess } from "@/lib/cm/dd-access";
import { runDdTool, DD_TOOLS_ORDER, toolsForKind, type DdTool } from "@/lib/cm/dd-tools";
import { pfBlockReason, PF_BLOCK_TEXT } from "@/lib/cm/dd-gates";
import { isNcndaCode, DD_RETENTION_MONTHS } from "@/lib/cm/dd-report";
import { loadParty, resolveContractCode, resolveDocument, namesByUserId } from "@/lib/cm/dd-party";

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

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  if (!(await hasDueDiligenceAccess(user.id))) {
    return { error: NextResponse.json({ error: "Sem permissão para Due Diligence" }, { status: 403, headers: NO_STORE }) };
  }
  return { userId: user.id };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const db = svc();

  const party = await loadParty(db, id);
  if (!party) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });

  const doc = resolveDocument(party);
  // Consulta de PF: so para decisor (cedente ou mandatario) com o aviso em versao minima. Fail closed.
  const pfBlock = doc.ok && doc.kind === "cpf"
    ? pfBlockReason(party.role_in_document as string | null, party.lgpd_text_version as string | null, process.env.DD_PF_MIN_LGPD_VERSION)
    : null;
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

  // Relatorio da pasta: precisa de NCNDA de origem e de ao menos uma consulta nos ultimos 12 meses.
  const reportCutoff = new Date();
  reportCutoff.setUTCMonth(reportCutoff.getUTCMonth() - DD_RETENTION_MONTHS);
  const hasRecentRun = (runs ?? []).some((r) => new Date(r.created_at as string) >= reportCutoff);
  const reportBlock = !isNcndaCode(contractCode)
    ? contractCode
      ? `Sem NCNDA de origem: o contrato de origem é ${contractCode}`
      : "Sem NCNDA de origem: a parte não tem contrato de origem no lote"
    : !hasRecentRun
    ? `Nenhuma consulta nos últimos ${DD_RETENTION_MONTHS} meses`
    : null;

  const names = await namesByUserId(db, (runs ?? []).map((r) => r.requested_by as string));
  return NextResponse.json(
    {
      report_block_reason: reportBlock,
      access: true,
      document: doc.ok ? { kind: doc.kind, available: doc.kind === "cnpj" || !pfBlock } : { kind: null, available: false, reason: doc.reason },
      pf_blocked_reason: pfBlock ? PF_BLOCK_TEXT[pfBlock] : null,
      contract_code: contractCode,
      tools: doc.ok ? toolsForKind(doc.kind) : DD_TOOLS_ORDER,
      recent_days: RECENT_DAYS,
      recent,
      runs: (runs ?? []).map((r) => ({ ...r, has_raw: r.tool === "scr_cpf" && r.status === "ok", requested_by_name: names[r.requested_by as string] ?? "Usuário", requested_by: undefined })),
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
  if (!toolsForKind(doc.kind).includes(tool)) {
    return NextResponse.json({ error: "Esta consulta não se aplica ao tipo de documento da parte" }, { status: 422, headers: NO_STORE });
  }
  if (doc.kind === "cpf") {
    const block = pfBlockReason(party.role_in_document as string | null, party.lgpd_text_version as string | null, process.env.DD_PF_MIN_LGPD_VERSION);
    if (block) {
      // Tentativa registrada ANTES de negar (nunca `void`: o builder do supabase-js nao envia sem await).
      const { error: blockLogError } = await db.from("audit_logs").insert({
        user_id: auth.userId,
        action: "dd_consulta_pf_bloqueada",
        entity: "cm_party_qualifications",
        entity_id: id,
        new_data: { motivo: block, ferramenta: tool },
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
      });
      if (blockLogError) console.error("[due-diligence] falha ao registrar tentativa de PF bloqueada", { party_id: id, code: blockLogError.code });
      return NextResponse.json({ error: PF_BLOCK_TEXT[block] }, { status: 403, headers: NO_STORE });
    }
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
  const outcome = await runDdTool(tool, doc.value, doc.kind);

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
      raw_data: doc.kind === "cpf" ? (outcome.raw ?? null) : null,
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

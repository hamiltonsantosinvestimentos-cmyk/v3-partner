import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

/**
 * POST /api/governance/ingest — varredura sistemática de governança
 * (v3-governance-qa), aprovada por João em 21/09/2026 após o piloto de
 * 3 funcionalidades (3/3 BLOQUEADO, 26 achados).
 *
 * Chamada pela rotina agendada em nuvem que roda o agente @v3-governance-qa
 * (~4 funcionalidades/dia, 45 dias para cobrir o portal inteiro), nunca por
 * uma tela ou por um usuário logado -- por isso autentica por token
 * compartilhado (GOVERNANCE_INGEST_TOKEN), não por sessão Supabase. A chave
 * de serviço do banco nunca sai da plataforma: só esta rota grava usando o
 * service role, a rotina externa só conhece o token do bearer.
 *
 * Upsert por nome de funcionalidade (governance_features.name, chave única):
 * a mesma funcionalidade reauditada em outro dia atualiza a mesma linha,
 * nunca duplica. Cada chamada grava 1 audit_run + N findings.
 */

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const FEATURE_KINDS = ["route", "page", "component", "lib_compartilhada"] as const;
const VERDICTS = ["LIBERADO", "BLOQUEADO"] as const;
const SEVERITIES = ["bloqueante", "sugestao"] as const;

interface IngestFeature {
  name: string;
  area: string;
  kind: (typeof FEATURE_KINDS)[number];
  paths: string[];
}

interface IngestAuditRun {
  verdict: (typeof VERDICTS)[number];
  findings_count: number;
  total_tokens?: number | null;
  duration_ms?: number | null;
  raw_report: string;
}

interface IngestFinding {
  rule_id: string;
  severity?: (typeof SEVERITIES)[number];
  summary: string;
  file_path?: string | null;
  line_hint?: string | null;
  excerpt?: string | null;
  correction_required: string;
  scheduled_for?: string | null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 422 });
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.GOVERNANCE_INGEST_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "GOVERNANCE_INGEST_TOKEN não configurado no servidor" }, { status: 500 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { feature?: IngestFeature; audit?: IngestAuditRun; findings?: IngestFinding[] };
  try {
    body = await request.json();
  } catch {
    return badRequest("Body inválido (JSON esperado)");
  }

  const { feature, audit, findings } = body;

  if (!feature?.name?.trim() || !feature?.area?.trim()) return badRequest("feature.name e feature.area são obrigatórios");
  if (!FEATURE_KINDS.includes(feature.kind)) return badRequest(`feature.kind precisa ser um de: ${FEATURE_KINDS.join(", ")}`);
  if (!Array.isArray(feature.paths) || feature.paths.length === 0) return badRequest("feature.paths precisa ter ao menos 1 caminho");
  if (!audit || !VERDICTS.includes(audit.verdict)) return badRequest(`audit.verdict precisa ser um de: ${VERDICTS.join(", ")}`);
  if (typeof audit.findings_count !== "number") return badRequest("audit.findings_count é obrigatório");
  if (!audit.raw_report?.trim()) return badRequest("audit.raw_report é obrigatório (relatório completo da skill)");
  const findingList = findings ?? [];
  for (const f of findingList) {
    if (!f.rule_id?.trim() || !f.summary?.trim() || !f.correction_required?.trim()) {
      return badRequest("cada finding precisa de rule_id, summary e correction_required");
    }
    if (f.severity && !SEVERITIES.includes(f.severity)) {
      return badRequest(`finding.severity precisa ser um de: ${SEVERITIES.join(", ")}`);
    }
  }

  const db = svc();

  // Upsert da funcionalidade por nome (chave única) -- nunca calcular/adivinhar
  // se já existe, sempre deixar o banco resolver via onConflict.
  const { data: featureRow, error: featureError } = await db
    .from("governance_features")
    .upsert(
      { name: feature.name.trim(), area: feature.area.trim(), kind: feature.kind, paths: feature.paths, status: "auditado" },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (featureError || !featureRow) {
    return NextResponse.json({ error: `Falha ao gravar feature: ${featureError?.message}` }, { status: 500 });
  }

  const { data: runRow, error: runError } = await db
    .from("governance_audit_runs")
    .insert({
      feature_id: featureRow.id,
      verdict: audit.verdict,
      findings_count: audit.findings_count,
      total_tokens: audit.total_tokens ?? null,
      duration_ms: audit.duration_ms ?? null,
      raw_report: audit.raw_report,
    })
    .select("id")
    .single();

  if (runError || !runRow) {
    return NextResponse.json({ error: `Falha ao gravar audit_run: ${runError?.message}` }, { status: 500 });
  }

  await db.from("governance_features").update({ last_audit_run_id: runRow.id }).eq("id", featureRow.id);

  if (findingList.length > 0) {
    const rows = findingList.map((f) => ({
      audit_run_id: runRow.id,
      feature_id: featureRow.id,
      rule_id: f.rule_id,
      severity: f.severity ?? "bloqueante",
      summary: f.summary,
      file_path: f.file_path ?? null,
      line_hint: f.line_hint ?? null,
      excerpt: f.excerpt ?? null,
      correction_required: f.correction_required,
      scheduled_for: f.scheduled_for ?? null,
    }));
    const { error: findingsError } = await db.from("governance_findings").insert(rows);
    if (findingsError) {
      return NextResponse.json({ error: `audit_run gravado, mas falha ao gravar findings: ${findingsError.message}`, audit_run_id: runRow.id }, { status: 500 });
    }
  }

  return NextResponse.json({ feature_id: featureRow.id, audit_run_id: runRow.id, findings_inserted: findingList.length });
}

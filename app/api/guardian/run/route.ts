import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface N8nData {
  workflow_count: number;
  active_count: number;
  recent_errors: number;
  workflows: string[];
}

interface RawData {
  n8n: N8nData;
  supabase?: { table_count: number; tables: string[] };
}

async function callHaiku(prompt: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });
  return (msg.content[0] as { type: string; text: string }).text;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-v3-service-token");
  if (!token || token !== process.env.V3_INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();

  try {
    const body = await req.json();
    const { run_id, raw_data } = body as { run_id: string; raw_data: RawData };

    if (!run_id || !raw_data?.n8n) {
      return NextResponse.json({ error: "run_id and raw_data.n8n required" }, { status: 400 });
    }

    const ctx = `
ECOSSISTEMA V3 PARTNERS — SNAPSHOT ${new Date().toISOString().split("T")[0]}

N8N:
- Total de workflows: ${raw_data.n8n.workflow_count}
- Workflows ativos: ${raw_data.n8n.active_count}
- Erros recentes (últimos 7d): ${raw_data.n8n.recent_errors}
- Nomes: ${raw_data.n8n.workflows.slice(0, 25).join(" | ")}

SUPABASE:
- Tabelas: ${raw_data.supabase?.table_count ?? 79}
- Principais: ${(raw_data.supabase?.tables ?? []).join(", ")}
`;

    // 3 chamadas Haiku em paralelo
    const [cartografo, sentinela, arbitro] = await Promise.all([
      callHaiku(
        `Você é arquiteto de sistemas. Analise este ecossistema SaaS e faça mapeamento estrutural em 6 bullet points concisos. Identifique: módulos críticos, integrações de risco, workflows sem monitoramento e dependências sistêmicas. Seja técnico.\n\n${ctx}`
      ),
      callHaiku(
        `Você é especialista em segurança (OWASP Top 10). Analise este ecossistema. Retorne até 5 findings no formato: [CRÍTICO/ATENÇÃO/INFO] — descrição em 1 linha. Foco em: superfície de ataque de integrações externas, workflows sem tratamento de erro, e observabilidade.\n\n${ctx}`
      ),
      callHaiku(
        `Você é auditor independente. Avalie este ecossistema SaaS e atribua 3 notas de 0-100. Responda EXATAMENTE neste formato:\nEFICIÊNCIA_OPERACIONAL: [número]\nMATURIDADE_ARQUITETURAL: [número]\nRISCO_OPERACIONAL: [número]\nJUSTIFICATIVA: [2 linhas máximo]\n\n${ctx}`
      ),
    ]);

    // Parse scores do árbitro
    const effMatch = arbitro.match(/EFICI[EÊ]NCIA_OPERACIONAL[:\s]+(\d{1,3})/i);
    const matMatch = arbitro.match(/MATURIDADE_ARQUITETURAL[:\s]+(\d{1,3})/i);
    const riskMatch = arbitro.match(/RISCO_OPERACIONAL[:\s]+(\d{1,3})/i);

    const health_score = effMatch ? Math.min(100, parseInt(effMatch[1])) : 72;
    const security_score = matMatch ? Math.min(100, parseInt(matMatch[1])) : 68;
    // Risco operacional é invertido: 0 risco = 100 de saúde
    const raw_risk = riskMatch ? Math.min(100, parseInt(riskMatch[1])) : 35;
    const efficiency_score = Math.max(0, 100 - raw_risk);

    const duration_ms = Date.now() - started;

    const { data, error } = await svc()
      .from("guardian_snapshots")
      .insert({
        run_id,
        scope: "all",
        status: "completed",
        health_score,
        security_score,
        efficiency_score,
        n8n_workflow_count: raw_data.n8n.workflow_count,
        portal_route_count: raw_data.supabase?.table_count ?? 79,
        topology_summary: cartografo,
        security_findings: { raw: sentinela },
        audit_findings: { raw: arbitro },
        raw_data,
        duration_ms,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[guardian/run] Supabase error:", error);
      return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
    }

    const summary = [
      `GUARDIAN ${new Date().toISOString().split("T")[0]}`,
      `Health: ${health_score}/100 | Security: ${security_score}/100 | Efficiency: ${efficiency_score}/100`,
      `n8n: ${raw_data.n8n.workflow_count} workflows (${raw_data.n8n.active_count} ativos, ${raw_data.n8n.recent_errors} erros)`,
    ].join("\n");

    return NextResponse.json({
      success: true,
      snapshot_id: data.id,
      scores: { health_score, security_score, efficiency_score },
      summary,
      cartografo,
      sentinela,
      arbitro,
      duration_ms,
    });
  } catch (e) {
    console.error("[guardian/run]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

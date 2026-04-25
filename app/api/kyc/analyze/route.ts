import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

const CNJ_PROXY_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cnj-proxy`;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function calcScore(flags: {
  blacklist: boolean;
  sanctions: boolean;
  processes: number;
  cnpjOk: boolean;
  entityType: "PJ" | "PF";
}): { score: number; risk_label: "BAIXO RISCO" | "RISCO MÉDIO" | "ALTO RISCO"; verdict: "Aprovado" | "Condicional" | "Bloqueado" } {
  let score = 100;

  if (flags.blacklist) score -= 60;
  if (flags.sanctions) score -= 40;
  if (!flags.cnpjOk && flags.entityType === "PJ") score -= 20;
  if (flags.processes >= 10) score -= 25;
  else if (flags.processes >= 3) score -= 15;
  else if (flags.processes >= 1) score -= 8;

  score = Math.max(0, score);

  const risk_label = score >= 70 ? "BAIXO RISCO" : score >= 40 ? "RISCO MÉDIO" : "ALTO RISCO";
  const verdict = score >= 70 ? "Aprovado" : score >= 40 ? "Condicional" : "Bloqueado";

  return { score, risk_label, verdict };
}

export async function POST(req: Request) {
  const { entity_doc, entity_name, entity_type = "PJ", operation_type, dd_level = "Padrão" } = await req.json();

  if (!entity_doc) {
    return NextResponse.json({ error: "entity_doc obrigatório" }, { status: 400 });
  }

  // Demo mode — return mock result
  if (IS_DEMO) {
    return NextResponse.json({
      score: 82,
      risk_label: "BAIXO RISCO",
      verdict: "Aprovado",
      sources_used: ["BrasilAPI", "OpenSanctions", "CNJ DataJud"],
      raw_data: { demo: true },
      cnpj_data: null,
      sanctions: [],
      processes: [],
      blacklist_match: null,
    });
  }

  const { createClient, createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const sources_used: string[] = [];
  const raw_data: Record<string, unknown> = {};

  // ── 1. BrasilAPI CNPJ ──────────────────────────────────────
  let cnpj_data = null;
  let cnpjOk = true;
  const cleanDoc = entity_doc.replace(/\D/g, "");

  if (entity_type === "PJ" && cleanDoc.length === 14) {
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanDoc}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        cnpj_data = await r.json();
        cnpjOk = cnpj_data?.descricao_situacao_cadastral?.toLowerCase() === "ativa";
        raw_data.cnpj = cnpj_data;
        sources_used.push("BrasilAPI");
      }
    } catch { /* timeout — continue */ }
  }

  // ── 2. OpenSanctions ────────────────────────────────────────
  let sanctions: unknown[] = [];
  const searchName = entity_name || cnpj_data?.razao_social || "";
  if (searchName) {
    try {
      const r = await fetch(
        `https://api.opensanctions.org/match/default?algorithm=best&limit=5`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries: { q1: { schema: "Thing", properties: { name: [searchName] } } } }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (r.ok) {
        const data = await r.json();
        sanctions = data?.responses?.q1?.results ?? [];
        raw_data.sanctions = sanctions;
        sources_used.push("OpenSanctions");
      }
    } catch { /* timeout — continue */ }
  }

  // ── 3. CNJ DataJud via Edge Function ───────────────────────
  let processes: unknown[] = [];
  try {
    const r = await fetch(CNJ_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ doc: entity_doc, nome: searchName }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const data = await r.json();
      processes = data?.hits ?? [];
      raw_data.cnj = data;
      sources_used.push("CNJ DataJud");
    }
  } catch { /* timeout — continue */ }

  // ── 4. Blacklist V3 ─────────────────────────────────────────
  const svc = await createServiceClient();
  let blacklist_match = null;

  const { data: blByDoc } = await svc.from("kyc_blacklist").select("*").eq("active", true).eq("doc", cleanDoc);
  const { data: blByName } = await svc.from("kyc_blacklist").select("*").eq("active", true).ilike("name", `%${searchName}%`);
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blRows = [...((blByDoc ?? []) as any[]), ...((blByName ?? []) as any[])].filter((r: Record<string, unknown>) => {
    const id = r.id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (blRows && blRows.length > 0) {
    blacklist_match = blRows[0];
    raw_data.blacklist = blRows;
    sources_used.push("Black List V3");
  }

  // ── 5. Calcular score ───────────────────────────────────────
  const { score, risk_label, verdict } = calcScore({
    blacklist: !!blacklist_match,
    sanctions: sanctions.length > 0,
    processes: processes.length,
    cnpjOk,
    entityType: entity_type,
  });

  // ── 6. Salvar análise ────────────────────────────────────────
  const { data: analysis } = await supabase
    .from("kyc_analyses")
    .insert({
      analyst_id: user.id,
      entity_doc,
      entity_name: searchName || entity_name,
      entity_type,
      operation_type,
      dd_level,
      score,
      risk_label,
      verdict,
      sources_used,
      raw_data,
    })
    .select()
    .single();

  // ── 7. Log de auditoria ──────────────────────────────────────
  await supabase.from("kyc_access_log").insert({
    user_id: user.id,
    action: "KYC_ANALYSIS",
    status: "ok",
    entity_doc,
    entity_name: searchName || entity_name,
    score,
  });

  return NextResponse.json({
    analysis_id: analysis?.id,
    score,
    risk_label,
    verdict,
    sources_used,
    cnpj_data,
    sanctions,
    processes,
    blacklist_match,
    raw_data,
  });
}

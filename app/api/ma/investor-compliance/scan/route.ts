import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buscarProcessosEscavador } from "@/lib/escavador";
import { runChecktudoComplianceScan } from "@/lib/checktudo";
import { resolveClient } from "@/lib/v3-clients";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];
const LGPD_PURPOSE = "ma_investor_compliance_kyc";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(supabaseUser: { id: string } | null) {
  if (!supabaseUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: profile } = await svc().from("profiles").select("role").eq("id", supabaseUser.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { userId: supabaseUser.id };
}

/** Um sign-off LGPD ativo para (processor, purpose). Gate real, checado a cada
 * execução, mesmo padrão já em produção em
 * app/api/cm/listings/[id]/compliance-scan/route.ts. */
async function hasActiveSignoff(processor: string): Promise<boolean> {
  const { data } = await svc()
    .from("lgpd_processor_signoffs")
    .select("id")
    .eq("processor", processor)
    .eq("purpose", LGPD_PURPOSE)
    .eq("active", true)
    .maybeSingle();
  return !!data;
}

function calcScore(input: {
  blacklist: boolean;
  processCount: number;
  sourcesFailed: number;
  sourcesTotal: number;
}): { score: number | null; risk_label: string | null; verdict: string | null } {
  // Nenhuma fonte respondeu: nunca fabricar "ficha limpa" por ausência de dado.
  if (input.sourcesFailed >= input.sourcesTotal) {
    return { score: null, risk_label: null, verdict: null };
  }

  let score = 100;
  if (input.blacklist) score -= 60;
  if (input.processCount >= 10) score -= 25;
  else if (input.processCount >= 3) score -= 15;
  else if (input.processCount >= 1) score -= 8;
  score = Math.max(0, score);

  const risk_label = score >= 70 ? "BAIXO RISCO" : score >= 40 ? "RISCO MÉDIO" : "ALTO RISCO";
  const verdict = score >= 70 ? "Aprovado" : score >= 40 ? "Condicional" : "Bloqueado";
  return { score, risk_label, verdict };
}

/** Histórico de checagens, mais recente primeiro. Filtro opcional por CPF. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const doc = req.nextUrl.searchParams.get("doc")?.replace(/\D/g, "");

  let query = svc()
    .from("ma_investor_compliance_checks")
    .select(
      "id, entity_name, entity_doc, dd_level, status, score, risk_label, verdict, pdf_path, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (doc) query = query.eq("entity_doc", doc);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checks: data ?? [] });
}

/**
 * Fase 1: roda Escavador + Checktudo (SCR + Dossiê Jurídico Resumido) + Black
 * List V3 em paralelo, calcula score e grava. Nunca engole erro de fonte em
 * log só: cada falha vira uma entrada em source_errors (mesma lição do
 * incidente de 03/08/2026 no Credit Engine).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { entity_name, entity_doc, dd_level, notes } = body as {
    entity_name?: string;
    entity_doc?: string;
    dd_level?: "SDD" | "Padrão" | "EDD";
    notes?: string;
  };

  const docDigits = entity_doc?.replace(/\D/g, "") ?? "";
  if (!entity_name?.trim() || docDigits.length !== 11) {
    return NextResponse.json({ error: "entity_name e um CPF válido (11 dígitos) são obrigatórios" }, { status: 422 });
  }

  const service = svc();

  // Gate LGPD: bloqueante, checado a cada execução. Ver Feature Spec 2026-09-16.
  const [escavadorSignoff, checktudoSignoff] = await Promise.all([
    hasActiveSignoff("escavador"),
    hasActiveSignoff("checktudo"),
  ]);
  if (!escavadorSignoff || !checktudoSignoff) {
    return NextResponse.json(
      {
        error:
          "Sign-off LGPD pendente (processor em escavador/checktudo, purpose=ma_investor_compliance_kyc). " +
          "Consultar Robson Lino antes de rodar checagem real sobre CPF de terceiro. " +
          "Ver Feature Spec 2026-09-16, seção LGPD.",
      },
      { status: 422 }
    );
  }

  const escavadorToken = process.env.ESCAVADOR_API_TOKEN;
  const checktudoUsername = process.env.CHECKTUDO_USERNAME;
  const checktudoPassword = process.env.CHECKTUDO_PASSWORD;

  const sourceErrors: { source: string; message: string }[] = [];

  // Fonte 1: Escavador
  let escavadorResult: unknown = null;
  if (!escavadorToken) {
    sourceErrors.push({ source: "escavador", message: "ESCAVADOR_API_TOKEN não configurado" });
  } else {
    try {
      escavadorResult = await buscarProcessosEscavador("cpf", docDigits, escavadorToken);
    } catch (err) {
      sourceErrors.push({ source: "escavador", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Fonte 2: Checktudo (SCR + Dossiê Jurídico Resumido)
  let checktudoScr: unknown = null;
  let checktudoDossie: unknown = null;
  if (!checktudoUsername || !checktudoPassword) {
    sourceErrors.push({ source: "checktudo", message: "CHECKTUDO_USERNAME/CHECKTUDO_PASSWORD não configurados" });
  } else {
    try {
      const scan = await runChecktudoComplianceScan(checktudoUsername, checktudoPassword, "cpf", docDigits);
      checktudoScr = { normalized: scan.scr.normalized, risk_flags: scan.scr.normalized.risk_flags };
      checktudoDossie = { normalized: scan.dossieResumido.normalized, risk_flags: scan.dossieResumido.normalized.risk_flags };
    } catch (err) {
      sourceErrors.push({ source: "checktudo", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Fonte 3: Black List V3 (custo zero, tabela já existente)
  const { data: blByDoc } = await service.from("kyc_blacklist").select("*").eq("active", true).eq("doc", docDigits);
  const { data: blByName } = await service
    .from("kyc_blacklist")
    .select("*")
    .eq("active", true)
    .ilike("name", `%${entity_name.trim()}%`);
  const blacklistMatch = (blByDoc && blByDoc[0]) ?? (blByName && blByName[0]) ?? null;

  // Score
  const dossieFlags = (checktudoDossie as { risk_flags?: Record<string, unknown> } | null)?.risk_flags;
  // Achado real em produção (16/09/2026): a API do Escavador pode devolver
  // total_processos=0 no campo raiz mesmo com o array `processos` populado
  // (mesma classe de inconsistência campo-a-campo já documentada para Serasa
  // em 03/08/2026 e Checktudo em 10/09/2026). Nunca confiar só no contador da
  // API: usar o maior entre o contador declarado e a contagem real do array
  // retornado, senão o score sai inflado silenciosamente.
  const escavadorProcessos = (escavadorResult as { processos?: unknown[] } | null)?.processos ?? [];
  const escavadorTotal = Math.max(
    (escavadorResult as { total_processos?: number } | null)?.total_processos ?? 0,
    escavadorProcessos.length
  );
  const dossieTotal = (dossieFlags?.lawsuit_total_count as number) ?? 0;
  const processCount = Math.max(escavadorTotal, dossieTotal);

  const sourcesTotal = 2; // escavador + checktudo (blacklist é sempre consultável, não conta como "fonte externa falha")
  const sourcesFailed = sourceErrors.filter((e) => e.source === "escavador" || e.source === "checktudo").length;

  const { score, risk_label, verdict } = calcScore({
    blacklist: !!blacklistMatch,
    processCount,
    sourcesFailed,
    sourcesTotal,
  });

  const status = sourcesFailed >= sourcesTotal ? "erro" : "concluido";

  const v3ClientId = await resolveClient(docDigits, { legalName: entity_name.trim(), vertical: "ma_investor_compliance" }).catch(
    () => null
  );

  const { data: inserted, error: insertError } = await service
    .from("ma_investor_compliance_checks")
    .insert({
      requested_by: auth.userId,
      entity_name: entity_name.trim(),
      entity_doc: docDigits,
      dd_level: dd_level ?? "Padrão",
      notes: notes ?? null,
      status,
      escavador_result: escavadorResult,
      escavador_queried_at: escavadorResult ? new Date().toISOString() : null,
      checktudo_scr_result: checktudoScr,
      checktudo_dossie_result: checktudoDossie,
      checktudo_queried_at: checktudoScr || checktudoDossie ? new Date().toISOString() : null,
      blacklist_match: blacklistMatch,
      source_errors: sourceErrors,
      score,
      risk_label,
      verdict,
      v3_client_id: v3ClientId,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Auditoria: reaproveita kyc_access_log já existente, best-effort.
  await service
    .from("kyc_access_log")
    .insert({
      user_id: auth.userId,
      action: "MA_INVESTOR_COMPLIANCE_CHECK",
      status: status === "concluido" ? "ok" : "parcial",
      entity_doc: docDigits,
      entity_name: entity_name.trim(),
      score,
    })
    .then(null, () => {});

  return NextResponse.json({
    id: inserted.id,
    status,
    score,
    risk_label,
    verdict,
    escavador_result: escavadorResult,
    checktudo_scr_result: checktudoScr,
    checktudo_dossie_result: checktudoDossie,
    blacklist_match: blacklistMatch,
    source_errors: sourceErrors,
    patrimonio: "não disponível nesta fase",
    participacao_empresas: "não disponível nesta fase",
  });
}

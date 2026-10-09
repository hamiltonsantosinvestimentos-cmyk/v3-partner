import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// GET /api/cron/dd-retention: descarte da Due Diligence aos 12 meses (Entrega 3, 08/10/2026).
// BRIEF: scratchpad brief-e3-dd.md (REVISAO v2). Mesmo padrao de /api/cron/purge-access-logs.
// /api/cron/ e publico no proxy.ts e esta rota APAGA dados: o Bearer CRON_SECRET e validado aqui dentro, sempre.
//
// MODO SIMULACAO: `?dry=1` (so com o Bearer) OU a variavel DD_RETENTION_ENABLED diferente de "true". Em simulacao nada
// e apagado: so conta e grava uma linha de auditoria do tipo dd_retencao_simulacao. O apagamento real so liga quando
// o Joao configura DD_RETENTION_ENABLED=true na Vercel, depois de ver o resultado de uma simulacao.
//
// O que descarta:
//   (a) cm_party_dd_runs.raw_data com mais de 12 meses vira NULL (o resumo da consulta permanece: prazo da linha de resumo
//       aguarda decisao do Robson, por isso NAO apagamos a linha);
//   (b) relatorios com expires_at vencido: arquivo no Storage (so pela API de Storage) e linha, em lote de ate 200, com
//       UMA linha de auditoria por relatorio apagado (id, NCNDA, identificador curto da parte, data), nunca nome ou documento;
//   (c) cm_party_dd_report_views com mais de 36 meses (retencao do log de aberturas).
// Falha em apagar mantem a linha. Se a auditoria de resultado falhar, a rota devolve 500.

export const maxDuration = 60;

const BUCKET = "dd-compliance";
const BATCH = 200;
const RAW_MONTHS = 12;
const VIEWS_MONTHS = 36;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const dryRequested = req.nextUrl.searchParams.get("dry") === "1";
  const realEnabled = process.env.DD_RETENTION_ENABLED === "true";
  const simulacao = dryRequested || !realEnabled;
  const db = svc();

  const rawCutoff = monthsAgo(RAW_MONTHS);
  const viewsCutoff = monthsAgo(VIEWS_MONTHS);
  const nowIso = new Date().toISOString();

  // Contagens (sempre).
  const [rawCount, expired, viewsCount] = await Promise.all([
    db.from("cm_party_dd_runs").select("id", { count: "exact", head: true }).lt("created_at", rawCutoff).not("raw_data", "is", null),
    db.from("cm_party_dd_reports").select("id, party_id, contract_code, file_path, created_at").lt("expires_at", nowIso).order("expires_at", { ascending: true }).limit(BATCH),
    db.from("cm_party_dd_report_views").select("id", { count: "exact", head: true }).lt("viewed_at", viewsCutoff),
  ]);
  if (rawCount.error || expired.error || viewsCount.error) {
    console.error("[cron dd-retention] falha ao contar", { a: rawCount.error?.code, b: expired.error?.code, c: viewsCount.error?.code });
    return NextResponse.json({ error: "Falha na retenção da Due Diligence" }, { status: 500 });
  }
  const reports = expired.data ?? [];
  const result = {
    modo: simulacao ? "simulacao" : "real",
    raw_a_limpar: rawCount.count ?? 0,
    relatorios_vencidos: reports.length,
    logs_de_abertura_vencidos: viewsCount.count ?? 0,
    raw_limpos: 0,
    relatorios_apagados: 0,
    relatorios_com_falha: 0,
    logs_apagados: 0,
  };

  if (!simulacao) {
    // (a) raw_data vira NULL
    if ((rawCount.count ?? 0) > 0) {
      const { error } = await db.from("cm_party_dd_runs").update({ raw_data: null }).lt("created_at", rawCutoff).not("raw_data", "is", null);
      if (error) console.error("[cron dd-retention] falha ao limpar raw_data", { code: error.code });
      else result.raw_limpos = rawCount.count ?? 0;
    }
    // (b) relatorios vencidos: Storage primeiro, depois a linha, uma auditoria por relatorio
    for (const r of reports) {
      const { error: rmError } = await db.storage.from(BUCKET).remove([r.file_path as string]);
      if (rmError) { result.relatorios_com_falha += 1; console.error("[cron dd-retention] falha ao apagar arquivo", { report_id: r.id }); continue; }
      const { error: delError } = await db.from("cm_party_dd_reports").delete().eq("id", r.id);
      if (delError) { result.relatorios_com_falha += 1; console.error("[cron dd-retention] falha ao apagar linha", { report_id: r.id, code: delError.code }); continue; }
      result.relatorios_apagados += 1;
      const { error: auditError } = await db.from("audit_logs").insert({
        action: "dd_relatorio_descartado",
        entity: "cm_party_dd_reports",
        entity_id: String(r.id),
        old_data: { contract_code: r.contract_code, party_short: String(r.party_id).replace(/-/g, "").slice(0, 8), created_at: r.created_at },
      });
      if (auditError) console.error("[cron dd-retention] falha ao auditar descarte", { report_id: r.id, code: auditError.code });
    }
    // (c) log de aberturas com mais de 36 meses
    if ((viewsCount.count ?? 0) > 0) {
      const { error } = await db.from("cm_party_dd_report_views").delete().lt("viewed_at", viewsCutoff);
      if (error) console.error("[cron dd-retention] falha ao apagar logs de abertura", { code: error.code });
      else result.logs_apagados = viewsCount.count ?? 0;
    }
  }

  // Linha de resultado, sempre com await; se falhar, a rota devolve 500.
  const { error: summaryError } = await db.from("audit_logs").insert({
    action: simulacao ? "dd_retencao_simulacao" : "dd_retencao_execucao",
    entity: "cm_party_dd_reports",
    entity_id: "cron",
    new_data: result,
  });
  if (summaryError) {
    console.error("[cron dd-retention] falha ao gravar a linha de resultado", { code: summaryError.code });
    return NextResponse.json({ error: "Falha ao registrar o resultado da retenção" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result, aviso: simulacao && !dryRequested ? "DD_RETENTION_ENABLED nao esta como true: rodou como simulacao" : undefined });
}

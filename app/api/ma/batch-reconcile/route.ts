import { resolveBucket } from "@/lib/storage-bucket";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

export const maxDuration = 300;

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type ExtractionRow = {
  id: string; doc_name: string; tipo_documento: string | null;
  dados_extraidos: Record<string, unknown> | null;
  pendencias: string[]; validation_flags: string[];
  confiabilidade: number | null; confiabilidade_por_campo: Record<string, number> | null;
  campos_baixa_confianca: { campo: string; confianca: number }[] | null;
  status: string; resumo: string | null;
};

// ─── HTML Report ──────────────────────────────────────────────────────────────

function buildReconciliationHtml(params: {
  dealCode: string; batchName: string; generatedAt: string;
  extractions: ExtractionRow[];
  stats: {
    total: number; success: number; error: number; needsReview: number;
    totalFields: number; highConf: number; lowConf: number;
    avgConf: number; divergences: number;
  };
}): string {
  const { dealCode, batchName, generatedAt, extractions, stats } = params;
  const confColor = (c: number) => c >= 80 ? "#10B981" : c >= 60 ? "#F59E0B" : "#EF4444";
  const statusBadge = (s: string) => {
    const cfg: Record<string, { color: string; bg: string; label: string }> = {
      done:         { color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Extraído" },
      needs_review: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Revisar" },
      error:        { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  label: "Erro" },
    };
    const d = cfg[s] ?? cfg.done;
    return `<span style="display:inline-flex;padding:2px 8px;border-radius:3px;font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${d.color};background:${d.bg};border:1px solid ${d.color}33;">${d.label}</span>`;
  };

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Relatório de Conciliação — ${dealCode}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 32px 0; }
  .page { width: 794px; min-height: 1123px; background: #111F35; margin: 0 auto 24px;
    box-shadow: 0 4px 40px rgba(0,0,0,0.7); }
  .stripe { height: 4px; background: linear-gradient(to right,#09081A,#C9A84C,#E8C97A,#C9A84C,#09081A); }
  .header { background: #09081A; padding: 18px 28px; display: flex;
    justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(201,168,76,0.2); }
  .body { padding: 20px 28px 28px; }
  .section-label { font-size: 7px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
    color: #C9A84C; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.2); }
  .card { background: #162744; border: 1px solid #243A66; border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
  .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 14px; }
  .stat-card { background: #162744; border: 1px solid #243A66; border-radius: 6px; padding: 12px 14px; text-align: center; }
  .stat-num { font-size: 28px; font-weight: 800; line-height: 1; }
  .stat-label { font-size: 7px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #7A8FA8; margin-top: 4px; }
  table.data { width: 100%; border-collapse: collapse; }
  .footer { background: #09081A; border-top: 1px solid rgba(201,168,76,0.15);
    padding: 10px 28px; display: flex; justify-content: space-between; align-items: center; }
  @media print {
    html,body { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important;
      background:#09081A!important; padding:0!important; margin:0!important; }
    .page { width:210mm!important; min-height:297mm!important; margin:0!important;
      box-shadow:none!important; page-break-after:always; }
  }
</style></head><body>

<div class="page">
  <div class="stripe"></div>

  <div class="header">
    <div style="display:flex;align-items:center;gap:14px;">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:36px;width:auto;"/>
      <div>
        <div style="font-size:7px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">
          Relatório de Conciliação · Lote de Documentos
        </div>
        <div style="font-size:14px;font-weight:700;color:#F0ECE4;">${dealCode} — ${batchName}</div>
        <div style="font-size:9px;color:#7A8FA8;">Gerado em ${generatedAt}</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;color:#7A8FA8;">Confiabilidade Média</div>
      <div style="font-size:32px;font-weight:800;color:${confColor(stats.avgConf)};line-height:1;">${stats.avgConf.toFixed(0)}</div>
      <div style="font-size:8px;color:#7A8FA8;">de 100 pontos</div>
    </div>
  </div>

  <div class="body">

    <div class="section-label">Resumo do Lote</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num" style="color:#F0ECE4;">${stats.total}</div><div class="stat-label">Total Docs</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#10B981;">${stats.success}</div><div class="stat-label">Extraídos</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#F59E0B;">${stats.needsReview}</div><div class="stat-label">Revisão</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#EF4444;">${stats.error}</div><div class="stat-label">Erros</div></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num" style="color:#C9A84C;">${stats.totalFields}</div><div class="stat-label">Campos Extraídos</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#10B981;">${stats.highConf}</div><div class="stat-label">Alta Confiança</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#F59E0B;">${stats.lowConf}</div><div class="stat-label">Baixa Confiança</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#EF4444;">${stats.divergences}</div><div class="stat-label">Divergências</div></div>
    </div>

    <div class="section-label">Detalhamento por Documento</div>
    <div class="card">
      <table class="data">
        <thead>
          <tr style="background:rgba(9,8,26,0.5);">
            <th style="padding:8px 10px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;text-align:left;">Documento</th>
            <th style="padding:8px 10px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;text-align:left;">Tipo</th>
            <th style="padding:8px 10px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;text-align:center;">Confiança</th>
            <th style="padding:8px 10px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;text-align:center;">Campos</th>
            <th style="padding:8px 10px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;text-align:center;">Pendências</th>
            <th style="padding:8px 10px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${extractions.map(ex => {
            const numCampos = Object.keys(ex.dados_extraidos ?? {}).length;
            const numPend   = (ex.pendencias?.length ?? 0) + (ex.validation_flags?.length ?? 0);
            const conf      = ex.confiabilidade ?? 0;
            return `
            <tr>
              <td style="padding:7px 10px;font-size:9px;color:#F0ECE4;border-bottom:1px solid #243A66;max-width:200px;">
                <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ex.doc_name}</div>
                ${ex.resumo ? `<div style="font-size:7px;color:#7A8FA8;margin-top:2px;line-height:1.4;">${ex.resumo.slice(0, 80)}...</div>` : ""}
              </td>
              <td style="padding:7px 10px;font-size:8px;color:#C9A84C;font-weight:700;border-bottom:1px solid #243A66;">${ex.tipo_documento ?? "—"}</td>
              <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #243A66;">
                <span style="font-size:13px;font-weight:800;color:${confColor(conf)};">${conf}</span>
                <span style="font-size:7px;color:#7A8FA8;">/100</span>
              </td>
              <td style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:#F0ECE4;border-bottom:1px solid #243A66;">${numCampos}</td>
              <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #243A66;">
                ${numPend > 0 ? `<span style="font-size:10px;font-weight:700;color:#EF4444;">${numPend}</span>` : `<span style="font-size:10px;color:#7A8FA8;">—</span>`}
              </td>
              <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #243A66;">${statusBadge(ex.status)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    ${extractions.filter(e => (e.pendencias?.length ?? 0) + (e.validation_flags?.length ?? 0) > 0).length > 0 ? `
    <div class="section-label">Divergências e Pendências Detectadas</div>
    <div class="card">
      ${extractions.filter(e => (e.pendencias?.length ?? 0) + (e.validation_flags?.length ?? 0) > 0).map(ex => {
        const allFlags = [...(ex.pendencias ?? []), ...(ex.validation_flags ?? [])];
        return `
        <div style="padding:10px 14px;border-bottom:1px solid #243A66;">
          <div style="font-size:8px;font-weight:700;color:#C9A84C;margin-bottom:6px;">${ex.doc_name}</div>
          ${allFlags.map(f => `<div style="font-size:8px;color:#F0ECE4;margin-bottom:3px;padding-left:8px;border-left:2px solid #EF4444;">⚠ ${f}</div>`).join("")}
        </div>`;
      }).join("")}
    </div>` : ""}

    <div style="padding:10px 14px;border:1px dashed rgba(201,168,76,0.2);border-radius:6px;font-size:8px;color:#7A8FA8;line-height:1.6;margin-top:8px;">
      Relatório gerado automaticamente pelo sistema de conciliação V3 Partners.<br/>
      Campos com confiança abaixo de 70 requerem validação manual antes de uso em valuation ou due diligence.<br/>
      <strong style="color:#F0ECE4;">CONFIDENCIAL — uso restrito V3 Partners · Mesa M&A.</strong>
    </div>

  </div>

  <div class="footer">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:24px;width:auto;opacity:0.85;"/>
      <div style="font-size:7px;color:#7A8FA8;line-height:1.6;">
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, RJ<br/>
        Relatório de Conciliação · ${dealCode}
      </div>
    </div>
    <div style="font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(201,168,76,0.4);">
      CONFIDENCIAL
    </div>
  </div>
</div>

</body></html>`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO podem gerar relatórios de conciliação" }, { status: 403 });
  }

  const body = await req.json() as { deal_id: string; batch_id: string; send_email?: boolean };
  const { deal_id, batch_id, send_email = true } = body;

  if (!deal_id || !batch_id) {
    return NextResponse.json({ error: "deal_id e batch_id são obrigatórios" }, { status: 400 });
  }

  // Busca todas as extrações do lote
  const { data: extractions, error: fetchErr } = await svc
    .from("ma_document_extractions")
    .select("id,doc_name,tipo_documento,dados_extraidos,pendencias,validation_flags,confiabilidade,confiabilidade_por_campo,campos_baixa_confianca,status,resumo")
    .eq("batch_id", batch_id)
    .eq("deal_id", deal_id)
    .order("created_at");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!extractions || extractions.length === 0) {
    return NextResponse.json({ error: "Nenhuma extração encontrada para este lote" }, { status: 404 });
  }

  // Busca dados do deal
  const { data: deal } = await svc
    .from("ma_deals")
    .select("target_company, sector, asset_data, v3_code, legacy_code")
    .eq("id", deal_id).single();

  const assetData = (deal?.asset_data ?? {}) as Record<string, unknown>;
  const dealCode  = (deal?.v3_code ?? deal?.legacy_code ?? deal_id.slice(0, 8).toUpperCase()) as string;

  // Calcula stats do lote
  const rows = extractions as ExtractionRow[];
  const totalFields     = rows.reduce((s, e) => s + Object.keys(e.dados_extraidos ?? {}).length, 0);
  const highConf        = rows.reduce((s, e) => s + Object.values(e.confiabilidade_por_campo ?? {}).filter(v => v >= 80).length, 0);
  const lowConf         = rows.reduce((s, e) => s + Object.values(e.confiabilidade_por_campo ?? {}).filter(v => v < 70).length, 0);
  const divergences     = rows.reduce((s, e) => s + (e.pendencias?.length ?? 0) + (e.validation_flags?.length ?? 0), 0);
  const confs           = rows.filter(e => e.confiabilidade !== null).map(e => e.confiabilidade as number);
  const avgConf         = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;

  const stats = {
    total:       rows.length,
    success:     rows.filter(e => e.status === "done").length,
    error:       rows.filter(e => e.status === "error").length,
    needsReview: rows.filter(e => e.status === "needs_review").length,
    totalFields, highConf, lowConf, divergences,
    avgConf: Math.round(avgConf * 10) / 10,
  };

  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const batchName   = (await svc.from("ma_batch_reconciliations").select("batch_name").eq("id", batch_id).single())
    .data?.batch_name ?? `Lote ${new Date().toLocaleDateString("pt-BR")}`;

  const reportHtml = buildReconciliationHtml({ dealCode, batchName, generatedAt, extractions: rows, stats });

  // Upload do relatório
  const timestamp   = Date.now();
  const storagePath = `${deal_id}/batch-reconcile-${timestamp}.html`;
  const BOM         = Buffer.from([0xEF, 0xBB, 0xBF]);
  const htmlBytes   = Buffer.concat([BOM, Buffer.from(reportHtml, "utf-8")]);

  let reportUrl = "";
  const { error: uploadErr } = await svc.storage
    .from(resolveBucket(storagePath))
    .upload(storagePath, htmlBytes, { contentType: "text/html; charset=utf-8", upsert: false });

  if (!uploadErr) {
    const { data: signed } = await svc.storage.from(resolveBucket(storagePath)).createSignedUrl(storagePath, 7 * 24 * 60 * 60);
    reportUrl = signed?.signedUrl ?? "";
  }

  // Atualiza registro do lote
  await svc.from("ma_batch_reconciliations").update({
    total_docs:             stats.total,
    docs_processed:         stats.total - stats.error,
    docs_success:           stats.success,
    docs_error:             stats.error,
    docs_needs_review:      stats.needsReview,
    total_fields_extracted: stats.totalFields,
    fields_high_confidence: stats.highConf,
    fields_low_confidence:  stats.lowConf,
    divergences_found:      stats.divergences,
    avg_confiabilidade:     stats.avgConf,
    report_html:            reportHtml,
    report_url:             reportUrl,
    status:                 "completed",
    completed_at:           new Date().toISOString(),
  }).eq("id", batch_id);

  // Salva referência no asset_data do deal
  const batchReports = ((assetData.batch_reconcile_reports ?? []) as unknown[]);
  batchReports.unshift({ batch_id, report_url: reportUrl, generated_at: new Date().toISOString(), stats });
  await svc.from("ma_deals").update({
    asset_data: { ...assetData, batch_reconcile_reports: batchReports.slice(0, 5) },
    updated_at: new Date().toISOString(),
  }).eq("id", deal_id);

  // Email para ADMIN/GESTAO
  let emailsSent = 0;
  if (send_email && process.env.RESEND_API_KEY) {
    const { data: admins } = await svc.from("profiles").select("email").in("role", ["ADMIN", "GESTAO"]);
    if (admins && admins.length > 0) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const reconcileSubjectGate = auditText(`[${dealCode}] Conciliação concluída: ${stats.success}/${stats.total} docs · conf. ${stats.avgConf}%`);
      const reconcileHtmlGate = auditHtml(`<p style="font-family:DM Sans,Arial;color:#F5F1E8;background:#09081A;padding:24px;">
          Lote <strong>${batchName}</strong> processado.<br/>
          ${stats.success} extraídos · ${stats.needsReview} requerem revisão · ${stats.error} erros<br/>
          Confiabilidade média: <strong>${stats.avgConf}%</strong> · Divergências: <strong>${stats.divergences}</strong><br/><br/>
          ${reportUrl ? `<a href="${reportUrl}" style="color:#C9A84C;">Ver Relatório Completo</a>` : ""}
        </p>`);
      if (reconcileHtmlGate.blocking.length > 0) console.error("[batch-reconcile] Brand Guardian bloqueou:", reconcileHtmlGate.blocking);
      await resend.emails.send({
        from:    "V3 Partners <noreply@v3partners.com.br>",
        to:      admins.map(a => a.email).filter(Boolean),
        subject: reconcileSubjectGate.corrected,
        html:    reconcileHtmlGate.corrected,
      }).then(() => { emailsSent = admins.length; }).catch(e => console.error("[batch-reconcile] email:", e));
    }
  }

  return NextResponse.json({ ok: true, batch_id, report_url: reportUrl, report_html: reportHtml, stats, emails_sent: emailsSent });
}

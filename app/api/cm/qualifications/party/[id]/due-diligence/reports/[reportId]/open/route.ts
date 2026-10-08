import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasDueDiligenceAccess } from "@/lib/cm/dd-access";
import { svc } from "@/lib/cm/dd-party";

// Abertura de um relatorio de Due Diligence (Entrega 3, 08/10/2026). Abrir e ler dado pessoal completo:
// - permissao por usuario (due_diligence_qualificacao), sem bypass para ADMIN;
// - limite de 30 aberturas em 10 minutos por usuario, contado no proprio log; falha na contagem NEGA (fail closed);
// - registro em cm_party_dd_report_views gravado com await ANTES do link assinado (60 segundos); falhou, o arquivo nao sai;
// - Cache-Control: no-store. O bucket e privado e sem policy: nao ha leitura direta de arquivo.

const NO_STORE = { "Cache-Control": "no-store" };
const BUCKET = "dd-compliance";
const SIGNED_URL_SECONDS = 60;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  if (!(await hasDueDiligenceAccess(user.id))) {
    return NextResponse.json({ error: "Sem permissão para Due Diligence" }, { status: 403, headers: NO_STORE });
  }

  const { id, reportId } = await params;
  const db = svc();
  const { data: report } = await db
    .from("cm_party_dd_reports")
    .select("id, party_id, contract_code, file_path")
    .eq("id", reportId)
    .eq("party_id", id)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404, headers: NO_STORE });

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await db
    .from("cm_party_dd_report_views")
    .select("id", { count: "exact", head: true })
    .eq("viewed_by", user.id)
    .gte("viewed_at", since);
  if (countError) {
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: "Muitas aberturas em pouco tempo, aguarde alguns minutos" }, { status: 429, headers: NO_STORE });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const partyShort = String(report.party_id).replace(/-/g, "").slice(0, 8).toLowerCase();
  const { error: logError } = await db.from("cm_party_dd_report_views").insert({
    report_id: report.id,
    contract_code: report.contract_code,
    party_short: partyShort,
    viewed_by: user.id,
    ip,
  });
  if (logError) {
    console.error("[dd-report open] falha ao gravar log de abertura", { report_id: reportId, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(report.file_path as string, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    console.error("[dd-report open] falha ao assinar o link", { report_id: reportId });
    return NextResponse.json({ error: "Não foi possível abrir o arquivo agora, tente novamente" }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ url: signed.signedUrl, expires_in_seconds: SIGNED_URL_SECONDS }, { headers: NO_STORE });
}

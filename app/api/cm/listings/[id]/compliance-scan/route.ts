import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { runChecktudoComplianceScan, type ChecktudoDocType } from "@/lib/checktudo";
import { hasComplianceDashboardAccess } from "@/lib/cm/compliance-access";

export const maxDuration = 60;

const LGPD_PROCESSOR = "checktudo";
const LGPD_PURPOSE = "bolsa_compliance_dashboard_due_diligence";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(supabaseUser: { id: string } | null) {
  if (!supabaseUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  // Gate do Cockpit de Compliance: allowlist de 5 pessoas via user_feature_access, nunca
  // role amplo (ADMIN/GESTAO/MESA_OPERACIONAL) -- mesmo padrão da Fase 0 (22/08/2026).
  const allowed = await hasComplianceDashboardAccess(supabaseUser.id);
  if (!allowed) return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  return { userId: supabaseUser.id };
}

/** Histórico de varreduras Checktudo já feitas neste ativo, mais recente primeiro. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { id } = await params;

  const { data, error } = await svc()
    .from("cm_compliance_checktudo_records")
    .select("id, query_type, query_value, querycode, score, protests_amount, cadastral_status, risk_flags, requested_by, created_at")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

/**
 * Roda uma varredura Checktudo real (SCR + Dossiê Jurídico Resumido) para o ativo.
 * BLOQUEADA até existir sign-off LGPD ativo em lgpd_processor_signoffs para
 * processor='checktudo', purpose='bolsa_compliance_dashboard_due_diligence' -- gate
 * duplo deliberado (o mesmo é checado antes de qualquer chamada real, nunca só
 * confiado ao fato de a chave existir). Ver BRIEF Fase 2, 27/08/2026.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { id } = await params;
  const service = svc();

  const { data: listing } = await service
    .from("cm_asset_listings")
    .select("id, seller_cpf_cnpj")
    .eq("id", id)
    .single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const body = await req.json();
  const { document_type, document_value } = body as { document_type?: ChecktudoDocType; document_value?: string };
  if (!document_type || !["cpf", "cnpj"].includes(document_type) || !document_value?.trim()) {
    return NextResponse.json({ error: "document_type (cpf|cnpj) e document_value são obrigatórios" }, { status: 422 });
  }
  const docValue = document_value.replace(/\D/g, "");

  // Gate LGPD: bloqueante, checado a cada execução, nunca só na primeira vez.
  const { data: signoff, error: signoffError } = await service
    .from("lgpd_processor_signoffs")
    .select("id")
    .eq("processor", LGPD_PROCESSOR)
    .eq("purpose", LGPD_PURPOSE)
    .eq("active", true)
    .maybeSingle();
  if (signoffError) return NextResponse.json({ error: signoffError.message }, { status: 500 });
  if (!signoff) {
    return NextResponse.json(
      {
        error:
          "Sign-off LGPD pendente para a Checktudo (processor=checktudo, purpose=bolsa_compliance_dashboard_due_diligence). " +
          "Consultar Robson Lino antes de habilitar consultas reais. Ver BRIEF Fase 2, Seção 'Sign-off'.",
      },
      { status: 422 }
    );
  }

  const username = process.env.CHECKTUDO_USERNAME;
  const password = process.env.CHECKTUDO_PASSWORD;
  if (!username || !password) {
    return NextResponse.json({ error: "CHECKTUDO_USERNAME/CHECKTUDO_PASSWORD não configurados" }, { status: 500 });
  }

  let scan;
  try {
    scan = await runChecktudoComplianceScan(username, password, document_type, docValue);
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao consultar Checktudo: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const rows = [
    {
      listing_id: id,
      query_type: document_type,
      query_value: docValue,
      querycode: 3090,
      score: scan.scr.normalized.score,
      protests_amount: scan.scr.normalized.protests_amount,
      cadastral_status: scan.scr.normalized.cadastral_status,
      risk_flags: scan.scr.normalized.risk_flags,
      raw_payload: scan.scr.raw,
      requested_by: auth.userId,
    },
    {
      listing_id: id,
      query_type: document_type,
      query_value: docValue,
      querycode: 200,
      score: scan.dossieResumido.normalized.score,
      protests_amount: scan.dossieResumido.normalized.protests_amount,
      cadastral_status: scan.dossieResumido.normalized.cadastral_status,
      risk_flags: scan.dossieResumido.normalized.risk_flags,
      raw_payload: scan.dossieResumido.raw,
      requested_by: auth.userId,
    },
  ];

  const { data: inserted, error: insertError } = await service
    .from("cm_compliance_checktudo_records")
    .insert(rows)
    .select("id, querycode, risk_flags, created_at");

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ records: inserted ?? [] });
}

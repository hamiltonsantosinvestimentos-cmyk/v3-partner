import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { renderRelatorioCompletoPDF, type RelatorioCompleto, type RelatorioOcrDoc, type RelatorioExtratoResumo } from "@/lib/relatorio-completo-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — compila perfil do cliente + OCR + análise dos 5C's num único PDF
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles").select("role").eq("id", user.id).single();

  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso restrito à mesa operacional" }, { status: 403 });
  }

  const { proposal_id } = await req.json();
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const { data: proposal, error: propErr } = await svc()
    .from("credit_desk_proposals")
    .select(`
      id, code, client_name, client_cpf_cnpj, credit_line, current_level,
      status, stage, requested_value, approved_value, metadata, created_at,
      partner:profiles!partner_id(full_name)
    `)
    .eq("id", proposal_id)
    .single();

  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  const partnerName = (proposal.partner as { full_name?: string } | null)?.full_name ?? undefined;

  const ocrResultadosMap = (meta.ocr_resultados as Record<string, RelatorioOcrDoc> | undefined) ?? {};
  const ocr_docs: RelatorioOcrDoc[] = Object.values(ocrResultadosMap);

  const extratosRaw = (meta.extratos_resumo as Array<{ banco: string; media_entrada_formatada: string | null }> | undefined) ?? [];
  const extratos_resumo: RelatorioExtratoResumo[] = extratosRaw
    .filter(e => e.media_entrada_formatada)
    .map(e => ({ banco: e.banco, media_entrada_formatada: e.media_entrada_formatada as string }));

  const relatorioData: RelatorioCompleto = {
    proposal_code: proposal.code,
    client_name: proposal.client_name,
    client_cpf_cnpj: proposal.client_cpf_cnpj,
    credit_line: proposal.credit_line,
    current_level: proposal.current_level,
    status: proposal.status,
    stage: proposal.stage ?? undefined,
    requested_value: proposal.requested_value,
    approved_value: proposal.approved_value,
    partner_name: partnerName,
    created_at: proposal.created_at,
    generated_at: new Date().toISOString(),
    perfil: {
      client_type: meta.client_type as string | undefined,
      email: meta.email as string | undefined,
      telefone: meta.telefone as string | undefined,
      rg: meta.rg as string | undefined,
      nascimento: meta.nascimento as string | undefined,
      estado_civil: meta.estado_civil as string | undefined,
      renda_mensal: meta.renda_mensal as number | undefined,
      razao_social: meta.razao_social as string | undefined,
      nome_fantasia: meta.nome_fantasia as string | undefined,
      socio_responsavel: meta.socio_responsavel as string | undefined,
      faturamento_mensal: meta.faturamento_mensal as number | undefined,
      endereco_rua: meta.endereco_rua as string | undefined,
      endereco_cidade: meta.endereco_cidade as string | undefined,
      endereco_uf: meta.endereco_uf as string | undefined,
      endereco_cep: meta.endereco_cep as string | undefined,
      restricao_cliente: meta.restricao_cliente as string | undefined,
      prazo: meta.prazo as string | undefined,
      finalidade: meta.finalidade as string | undefined,
      observacoes: meta.observacoes as string | undefined,
      imoveis: meta.imoveis as RelatorioCompleto["perfil"]["imoveis"],
    },
    ocr_docs,
    extratos_resumo,
    analise: (meta.ai_analysis as RelatorioCompleto["analise"]) ?? null,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderRelatorioCompletoPDF(relatorioData);
  } catch (e) {
    console.error("[relatorio-completo] Erro PDF:", e);
    return NextResponse.json({ error: `Erro ao gerar PDF: ${String(e)}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pdf_base64: pdfBuffer.toString("base64") });
}

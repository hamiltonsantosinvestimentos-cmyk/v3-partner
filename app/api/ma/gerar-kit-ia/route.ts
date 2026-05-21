import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export async function POST(req: NextRequest) {
  const svc = serviceClient();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
    if (!isAdmin) return NextResponse.json({ error: "Apenas gestores podem gerar o KIT" }, { status: 403 });

    const { deal_id } = await req.json();
    if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

    const { data: deal, error: dealError } = await svc
      .from("ma_deals")
      .select("id, code, target_company, sector, deal_value, ebitda_multiple, notes, location, asset_data")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
    }

    // Tenta criar job de rastreamento — falha graciosamente se tabela não existe
    let jobId: string | null = null;
    try {
      const { data: job } = await svc
        .from("creative_jobs")
        .insert({ deal_id, status: "PROCESSING", progress: 15, started_at: new Date().toISOString(), created_by: user.id })
        .select("id")
        .single();
      jobId = job?.id ?? null;
    } catch { /* tabela não existe — continua sem job tracking */ }

    const ad = (deal.asset_data ?? {}) as Record<string, unknown>;
    const empresa = deal.target_company;
    const setor = deal.sector ?? "não informado";
    const valor = deal.deal_value ? `R$ ${(deal.deal_value / 1e6).toFixed(1)}MM` : "não informado";
    const multiplo = deal.ebitda_multiple ? `${deal.ebitda_multiple}x EBITDA` : "a definir";
    const local = deal.location ?? "Brasil";
    const notas = deal.notes ?? "";
    const forjaResult = ad.forja_result as Record<string, unknown> | undefined;
    const forjaInfo = forjaResult
      ? `FORJA score ${ad.forja_score}, narrativa: ${forjaResult.narrative_pt ?? ""}`
      : "";

    // Constrói metricas a partir de financial_projections quando disponível
    const fp = ad.financial_projections as Record<string, unknown> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builtMetricas: { label: string; value: string; sub?: string }[] = (() => {
      if (!fp) return [
        { label: "Valor", value: valor, sub: "deal" },
        { label: "Múltiplo", value: multiplo, sub: "EBITDA" },
        { label: "Setor", value: setor, sub: "segmento" },
      ];
      const fmt = (v: number) =>
        v >= 1e9 ? `R$ ${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `R$ ${(v/1e6).toFixed(1)}M` : `R$ ${v.toLocaleString("pt-BR")}`;
      const receitas = (fp.receita as { ano: number; tipo: string; valor: number }[] ?? [])
        .filter(r => r.tipo === "realizado").sort((a, b) => b.ano - a.ano);
      const sc = fp.scenarios as Record<string, { noi_anual?: number; cap_rate?: number; valuation?: number }> | undefined;
      const m: { label: string; value: string; sub?: string }[] = [];
      if (receitas[0]) m.push({ label: `Receita ${receitas[0].ano}`, value: fmt(receitas[0].valor), sub: "realizado" });
      if (sc?.base?.noi_anual) m.push({ label: "NOI Base", value: fmt(sc.base.noi_anual), sub: "anual projetado" });
      if (sc?.base?.cap_rate) m.push({ label: "Cap Rate", value: `${(sc.base.cap_rate*100).toFixed(1)}%`, sub: "cenário base" });
      if (sc?.expansao?.valuation && deal.deal_value && sc.expansao.valuation > deal.deal_value)
        m.push({ label: "Upside", value: fmt(sc.expansao.valuation as number), sub: "+3 pav. projetado" });
      if (sc?.expansao?.noi_anual) m.push({ label: "NOI Expansão", value: fmt(sc.expansao.noi_anual), sub: "pós-obra" });
      if (sc?.expansao?.cap_rate) m.push({ label: "Cap Rate Exp.", value: `${(sc.expansao.cap_rate*100).toFixed(1)}%`, sub: "pós-expansão" });
      return m.length > 0 ? m : [
        { label: "Valor", value: valor, sub: "deal" },
        { label: "Múltiplo", value: multiplo, sub: "EBITDA" },
        { label: "Setor", value: setor, sub: "segmento" },
      ];
    })();

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `M&A analyst. Generate deal kit. Return ONLY valid JSON, no markdown, no explanation.

Deal: ${empresa} | Sector: ${setor} | Value: ${valor} | Multiple: ${multiplo} | Location: ${local}
${notas ? `Notes: ${notas}` : ""}
${forjaInfo ? `Context: ${forjaInfo}` : ""}

STRICT limits per field (exceed = invalid):
- descricao_ptbr: max 250 chars
- descricao_en: max 250 chars
- teaser_ptbr: max 180 chars (blind, no company name)
- teaser_en: max 180 chars (blind, no company name)
- linkedin_post_ptbr: max 400 chars, emojis ok, no company name
- linkedin_post_en: max 400 chars, emojis ok, no company name
- linkedin_story_ptbr: max 80 chars
- linkedin_story_en: max 80 chars
- diferenciais: exactly 3 strings, max 80 chars each (use real data from context)
- riscos: exactly 2 objects with real risks based on the deal context

{"descricao_ptbr":"...","descricao_en":"...","teaser_ptbr":"...","teaser_en":"...","linkedin_post_ptbr":"...","linkedin_post_en":"...","linkedin_story_ptbr":"...","linkedin_story_en":"...","diferenciais":["...","...","..."],"riscos":[{"nivel":"BAIXO","descricao":"...","mitigacao":"..."},{"nivel":"MÉDIO","descricao":"...","mitigacao":"..."}]}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Resposta inesperada da IA");

    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const kitContent = JSON.parse(raw);

    // Salva conteúdo gerado em asset_data — metricas computadas de financial_projections têm prioridade
    await svc.from("ma_deals").update({
      asset_data: {
        ...ad,
        ...kitContent,
        metricas: builtMetricas,   // substitui as genéricas do kit com dados reais
        kit_gerado_at: new Date().toISOString(),
        kit_job_id: jobId,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", deal_id);

    // Tenta registrar arquivos na tabela creative_files — falha graciosamente
    try {
      await svc.from("creative_files").delete().eq("deal_id", deal_id);
      const baseUrl = "https://v3-partner.vercel.app";
      const fileEntries = [
        { file_type: "cim",            language: "pt-br", format: "pdf" },
        { file_type: "cim",            language: "en",    format: "pdf" },
        { file_type: "teaser",         language: "pt-br", format: "pdf" },
        { file_type: "teaser",         language: "en",    format: "pdf" },
        { file_type: "linkedin_post",  language: "pt-br", format: "jpg" },
        { file_type: "linkedin_post",  language: "en",    format: "jpg" },
        { file_type: "linkedin_story", language: "pt-br", format: "jpg" },
        { file_type: "linkedin_story", language: "en",    format: "jpg" },
      ].map(f => ({
        deal_id,
        job_id: jobId,
        file_type: f.file_type,
        language: f.language,
        format: f.format,
        storage_path: `/api/ma/preview-criativo?dealId=${deal_id}&type=${f.file_type}&lang=${f.language}`,
        public_url: `${baseUrl}/api/ma/preview-criativo?dealId=${deal_id}&type=${f.file_type}&lang=${f.language}`,
        file_size_kb: null,
      }));
      await svc.from("creative_files").insert(fileEntries);
    } catch { /* tabela não existe — preview funciona via asset_data */ }

    // Finaliza job se existir
    if (jobId) {
      try {
        await svc.from("creative_jobs").update({
          status: "DONE", progress: 100, completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      } catch { /* ignora */ }
    }

    return NextResponse.json({ ok: true, job_id: jobId });

  } catch (error) {
    console.error("[gerar-kit-ia]", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro ao gerar KIT: ${msg}` }, { status: 500 });
  }
}

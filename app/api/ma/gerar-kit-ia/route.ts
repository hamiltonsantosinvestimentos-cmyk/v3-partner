import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

async function markJobError(svc: ReturnType<typeof sc>, jobId: string, msg: string) {
  await svc.from("creative_jobs").update({
    status: "ERROR",
    error_message: msg,
    completed_at: new Date().toISOString(),
  }).eq("id", jobId);
}

export async function POST(req: NextRequest) {
  const svc = serviceClient();
  let jobId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
    if (!isAdmin) return NextResponse.json({ error: "Apenas gestores podem gerar o KIT" }, { status: 403 });

    const { deal_id } = await req.json();
    if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

    // Busca dados do deal
    const { data: deal, error: dealError } = await svc
      .from("ma_deals")
      .select("id, code, target_company, sector, deal_value, ebitda_multiple, notes, location, asset_data")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

    // Verifica se já tem FORJA aprovado no asset_data
    const ad = (deal.asset_data ?? {}) as Record<string, unknown>;

    // Cria job
    const { data: job, error: jobError } = await svc
      .from("creative_jobs")
      .insert({ deal_id, status: "PROCESSING", progress: 15, started_at: new Date().toISOString(), created_by: user.id })
      .select("id")
      .single();

    if (jobError || !job) return NextResponse.json({ error: "Erro ao criar job" }, { status: 500 });
    jobId = job.id;

    if (!process.env.ANTHROPIC_API_KEY) {
      await markJobError(svc, jobId, "ANTHROPIC_API_KEY não configurada");
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Prompt compacto para resposta rápida
    const empresa = deal.target_company;
    const setor = deal.sector ?? "não informado";
    const valor = deal.deal_value ? `R$ ${(deal.deal_value / 1e6).toFixed(1)}MM` : "não informado";
    const multiplo = deal.ebitda_multiple ? `${deal.ebitda_multiple}x EBITDA` : "a definir";
    const local = deal.location ?? "Brasil";
    const notas = deal.notes ?? "";
    const forjaResult = ad.forja_result as Record<string, unknown> | undefined;
    const forjaInfo = forjaResult
      ? `Resultado FORJA: score ${ad.forja_score}, ${forjaResult.narrative_pt ?? ""}`
      : "";

    const prompt = `M&A analyst. Generate deal kit. Return ONLY valid JSON, no markdown, no explanation.

Deal: ${empresa} | Sector: ${setor} | Value: ${valor} | Multiple: ${multiplo} | Location: ${local}
${notas ? `Notes: ${notas}` : ""}

STRICT limits per field (exceed = invalid):
- descricao_ptbr: max 250 chars
- descricao_en: max 250 chars
- teaser_ptbr: max 180 chars (blind, no company name)
- teaser_en: max 180 chars (blind, no company name)
- linkedin_post_ptbr: max 400 chars, emojis ok, no company name
- linkedin_post_en: max 400 chars, emojis ok, no company name
- linkedin_story_ptbr: max 80 chars
- linkedin_story_en: max 80 chars
- diferenciais: exactly 3 strings, max 60 chars each
- riscos: exactly 2 objects

{"descricao_ptbr":"...","descricao_en":"...","teaser_ptbr":"...","teaser_en":"...","linkedin_post_ptbr":"...","linkedin_post_en":"...","linkedin_story_ptbr":"...","linkedin_story_en":"...","diferenciais":["...","...","..."],"metricas":[{"label":"Valor","value":"${valor}","sub":"deal"},{"label":"Múltiplo","value":"${multiplo}","sub":"EBITDA"},{"label":"Setor","value":"${setor}","sub":"segmento"}],"riscos":[{"nivel":"BAIXO","descricao":"...","mitigacao":"..."},{"nivel":"MÉDIO","descricao":"...","mitigacao":"..."}]}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Resposta inesperada da IA");

    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const kitContent = JSON.parse(raw);

    // Salva no asset_data
    await svc.from("ma_deals").update({
      asset_data: {
        ...ad,
        ...kitContent,
        kit_gerado_at: new Date().toISOString(),
        kit_job_id: jobId,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", deal_id);

    // Remove arquivos antigos e cria novos
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

    // Finaliza job
    await svc.from("creative_jobs").update({
      status: "DONE",
      progress: 100,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return NextResponse.json({ ok: true, job_id: jobId });

  } catch (error) {
    console.error("[gerar-kit-ia]", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (jobId) await markJobError(svc, jobId, msg);
    return NextResponse.json({ error: `Erro ao gerar KIT: ${msg}` }, { status: 500 });
  }
}

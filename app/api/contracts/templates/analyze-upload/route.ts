import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { extractContractText } from "@/lib/contract-upload-extract";

// POST /api/contracts/templates/analyze-upload — Fast-Track de Contratos
// Simples (BRIEF 30/08/2026, Fase A). Recebe um contrato já recebido pela
// Mesa (WhatsApp/e-mail), sobe para o Storage, cria a minuta em
// analysis_status=processando e dispara o webhook do n8n que roda o
// Agente Revisor de Riscos em background.
//
// ROTA ASSÍNCRONA POR DESENHO (ajuste explícito de João, 30/08/2026):
// leitura de PDF + chamada Sonnet facilmente passa dos 60s da Vercel.
// Esta rota só recebe o arquivo, grava e devolve "processando" — a
// orquestração pesada roda no n8n (mesmo padrão real já em produção em
// /api/ma/doc-extract para PDFs grandes, workflow W9 Doc Extract Large).
// O callback que fecha o ciclo é
// POST /api/contracts/templates/[id]/analysis-callback.

const WRITE_ROLES = ["ADMIN", "GESTAO"] as const;
const VALID_SERIES = ["V3C-ORG", "V3C-MAN", "V3C-PAR", "V3C-CES", "V3C-NDA", "V3C-LOI", "V3C-FPA", "V3C-FOR", "V3C-FUN"];
const VALID_VERTICALS = ["capital_markets", "credito", "ma", "institucional", "clientes", "talent_pool", "colaboradores"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !WRITE_ROLES.includes(profile.role as typeof WRITE_ROLES[number])) return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest) {
  const caller = await requireWriter();
  if (!caller)
    return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem enviar contrato para análise do agente" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const vertical = formData.get("vertical") as string | null;
  const contractSeries = formData.get("contract_series") as string | null;
  const templateNameRaw = formData.get("template_name") as string | null;
  const valorRaw = formData.get("valor_operacao_estimado") as string | null;

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 422 });

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize)
    return NextResponse.json({ error: "Arquivo excede 5MB" }, { status: 422 });

  const allowed = [".txt", ".docx", ".pdf"];
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowed.includes(ext))
    return NextResponse.json({ error: `Formato ${ext} não suportado. Use: ${allowed.join(", ")}` }, { status: 422 });

  if (!vertical || !VALID_VERTICALS.includes(vertical))
    return NextResponse.json({ error: `vertical obrigatório, um de: ${VALID_VERTICALS.join(", ")}` }, { status: 422 });
  if (!contractSeries || !VALID_SERIES.includes(contractSeries))
    return NextResponse.json({ error: `contract_series obrigatório, um de: ${VALID_SERIES.join(", ")}` }, { status: 422 });

  // Trava manual temporária dos R$50 mil (ajuste 3, decisão explícita de
  // João 30/08/2026): a Mesa precisa declarar o valor estimado da
  // operação ANTES do agente analisar. Não é opcional — sem isso não
  // existe hoje nenhum jeito automático de saber se o caminho "2/3 sócios
  // dispensa jurídico" pode ser usado nesta minuta.
  if (!valorRaw || !valorRaw.trim())
    return NextResponse.json({ error: "Valor da Operação estimado é obrigatório antes de enviar para análise" }, { status: 422 });
  const valorOperacaoEstimado = Number(valorRaw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(valorOperacaoEstimado) || valorOperacaoEstimado < 0)
    return NextResponse.json({ error: "Valor da Operação estimado inválido" }, { status: 422 });

  const db = svc();

  let text: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    text = await extractContractText(buffer, file.type, file.name);
    if (!text.trim())
      return NextResponse.json({ error: "Arquivo vazio ou sem texto extraível" }, { status: 422 });

    // Cria a linha primeiro (sem storage_path ainda) para já ter o id do
    // template e nomear o arquivo por ele, mesmo padrão de
    // contracts/manual-intake (cria o registro, depois nomeia o path com
    // o id real, nunca o contrário).
    const templateName = templateNameRaw?.trim() || `Análise IA · ${file.name.replace(/\.[^.]+$/, "")}`;

    const { data: template, error: insertErr } = await db
      .from("contract_templates")
      .insert({
        template_name: templateName,
        vertical,
        contract_series: contractSeries,
        body_text_raw: text.trim(), // texto original, será substituído pela minuta saneada no callback
        origem: "agente_ia",
        analysis_status: "processando",
        valor_operacao_estimado: valorOperacaoEstimado,
        created_by: caller.userId,
      })
      .select("id")
      .single();

    if (insertErr || !template)
      return NextResponse.json({ error: insertErr?.message ?? "Erro ao criar minuta" }, { status: 500 });

    const templateId = template.id as string;
    const storagePath = `contratos-recebidos/${templateId}${ext}`;

    // Alinhamento com o Agente Estruturador (02/09/2026, mesmo achado
    // anti-alucinação aplicado aqui a pedido de João): a diretriz de
    // "comparar contra o padrão institucional da V3" não tinha como o
    // agente cumprir sozinho sem receber exemplo nenhum de minuta real.
    // Busca até 3 minutas já aprovadas da MESMA vertical pra servir de
    // referência real no prompt; se não houver nenhuma, o agente é
    // avisado explicitamente disso, nunca finge ter uma referência
    // inexistente.
    const { data: referenceTemplates } = await db
      .from("contract_templates")
      .select("template_name, body_text_raw")
      .eq("vertical", vertical)
      .eq("approval_status", "aprovado")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(3);

    const { error: uploadErr } = await db.storage.from("documents").upload(storagePath, buffer, { upsert: true });
    if (uploadErr) {
      await db.from("contract_templates").update({
        analysis_status: "erro",
        analysis_error: `Falha ao salvar arquivo original: ${uploadErr.message}`,
      }).eq("id", templateId);
      return NextResponse.json({ error: `Falha ao salvar arquivo: ${uploadErr.message}` }, { status: 500 });
    }

    await db.from("contract_templates").update({ documento_original_path: storagePath }).eq("id", templateId);

    // Dispara o webhook do n8n, aguardando só a entrega (n8n responde em
    // <1s com "workflow started"), nunca o processamento completo — mesmo
    // padrão de app/api/ma/doc-extract para o webhook v3-doc-extract-large.
    const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
    if (!n8nBase) {
      await db.from("contract_templates").update({
        analysis_status: "erro",
        analysis_error: "N8N_API_URL não configurada — análise não pode ser disparada",
      }).eq("id", templateId);
      return NextResponse.json({ error: "Integração de análise não configurada (N8N_API_URL ausente)" }, { status: 500 });
    }

    try {
      await fetch(`${n8nBase}/webhook/v3-contract-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
        body: JSON.stringify({
          template_id: templateId,
          // Texto já extraído aqui no servidor (mammoth/pdf-parse) — o n8n
          // não precisa refazer a extração nem lidar com binário/Anthropic
          // Files API, só recebe o texto pronto e chama o Claude direto.
          document_text: text.trim().slice(0, 40000), // guarda de tamanho, mesmo espírito do limite de páginas do resto do sistema
          storage_path: storagePath,
          bucket: "documents",
          file_name: file.name,
          vertical,
          valor_operacao_estimado: valorOperacaoEstimado,
          reference_templates: (referenceTemplates ?? []).map((t) => ({
            template_name: t.template_name,
            body_text_raw: (t.body_text_raw as string).slice(0, 12000),
          })),
        }),
      });
    } catch (e) {
      console.error("[analyze-upload] webhook n8n falhou:", e);
      await db.from("contract_templates").update({
        analysis_status: "erro",
        analysis_error: "Não foi possível acionar o agente de análise. Tente novamente em 1 minuto.",
      }).eq("id", templateId);
      return NextResponse.json({ error: "Agente de análise indisponível. Tente novamente em 1 minuto." }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      template_id: templateId,
      analysis_status: "processando",
      message: "Análise iniciada. O Agente Revisor de Riscos está lendo o contrato e comparando com precedentes aprovados.",
    }, { status: 202 });
  } catch (err: any) {
    return NextResponse.json({ error: `Erro ao processar arquivo: ${err.message}` }, { status: 500 });
  }
}

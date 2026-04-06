/**
 * V3 Partners — Creative Engine
 * Serviço Express que recebe jobs da plataforma e gera criativos via Puppeteer.
 * Deploy: Railway (npm start)
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT (opcional)
 */

const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { generateKit } = require("./generator");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Supabase com service_role — NUNCA expor no frontend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "V3 Creative Engine", version: "1.0.0" });
});

// ── Disparar geração ──────────────────────────────────────────────────────────
app.post("/generate", async (req, res) => {
  const { job_id, deal_id } = req.body;

  if (!job_id || !deal_id) {
    return res.status(400).json({ error: "job_id e deal_id são obrigatórios" });
  }

  // Responde imediatamente — processamento é assíncrono
  res.json({ status: "accepted", job_id });

  // Processa em background
  processJob(job_id, deal_id).catch(async (err) => {
    console.error(`[Job ${job_id}] Erro fatal:`, err);
    await supabase.from("creative_jobs").update({
      status: "ERROR",
      error_message: err.message ?? String(err),
    }).eq("id", job_id);
  });
});

// ── Processamento do job ──────────────────────────────────────────────────────
async function processJob(jobId, dealId) {
  console.log(`\n▸ [Job ${jobId}] Iniciando geração para deal ${dealId}`);

  // Marcar como PROCESSING
  await supabase.from("creative_jobs").update({
    status: "PROCESSING",
    started_at: new Date().toISOString(),
    progress: 5,
  }).eq("id", jobId);

  // Buscar dados do deal
  const { data: deal, error: dealError } = await supabase
    .from("ma_deals")
    .select("*")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    throw new Error(`Deal ${dealId} não encontrado: ${dealError?.message}`);
  }

  await updateProgress(jobId, 10);

  // Gerar o kit completo (HTMLs + Puppeteer → arquivos)
  const generatedFiles = await generateKit(deal, jobId, (progress) => updateProgress(jobId, progress));

  await updateProgress(jobId, 90);

  // Fazer upload para Supabase Storage e registrar em creative_files
  const bucket = "creatives";
  const fileRecords = [];

  for (const file of generatedFiles) {
    const storagePath = `${dealId}/${file.filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Job ${jobId}] Upload falhou para ${file.filename}:`, uploadError.message);
      continue;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    fileRecords.push({
      deal_id: dealId,
      job_id: jobId,
      file_type: file.fileType,
      language: file.language,
      format: file.format,
      storage_path: storagePath,
      public_url: publicUrl,
      file_size_kb: Math.round(file.buffer.length / 1024),
    });
  }

  if (fileRecords.length > 0) {
    const { error: insertError } = await supabase.from("creative_files").insert(fileRecords);
    if (insertError) console.error(`[Job ${jobId}] Erro ao salvar creative_files:`, insertError.message);
  }

  // Marcar como DONE
  await supabase.from("creative_jobs").update({
    status: "DONE",
    progress: 100,
    completed_at: new Date().toISOString(),
  }).eq("id", jobId);

  console.log(`✓ [Job ${jobId}] Geração concluída — ${fileRecords.length} arquivos`);
}

async function updateProgress(jobId, progress) {
  await supabase.from("creative_jobs").update({ progress }).eq("id", jobId);
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`▸ V3 Creative Engine rodando na porta ${PORT}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? "configurado" : "NÃO CONFIGURADO"}`);
});

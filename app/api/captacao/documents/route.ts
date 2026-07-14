import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

const BUCKET = "captacao-documents";
const SIGNED_URL_EXPIRES = 60 * 60; // 1h — só para pré-visualização imediata no formulário
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50) || "arquivo";
}

// POST — upload de documento via token de captação (sem auth)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token  = formData.get("token") as string;
  const file   = formData.get("file") as File;
  const label  = (formData.get("label") as string) || "documento";

  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
  if (!file)  return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

  const svc = serviceClient();

  // Valida token
  const { data: link, error: linkError } = await svc
    .from("captacao_links")
    .select("id, partner_id, active")
    .eq("token", token)
    .single();

  if (linkError || !link || !link.active) {
    return NextResponse.json({ error: "Token inválido ou desativado" }, { status: 404 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande (máximo 10 MB)" }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: `Tipo de arquivo não permitido (${file.type}). Use PDF, imagem ou Word.` }, { status: 415 });
  }

  // Garante que o bucket existe (cria se necessário) — evita falha silenciosa
  // de upload quando o bucket ainda não foi provisionado no projeto Supabase.
  // Privado: documentos de KYC (RG, CPF, comprovantes) nunca podem ser públicos.
  const { data: buckets } = await svc.storage.listBuckets();
  const existingBucket = buckets?.find((b) => b.name === BUCKET);
  if (!existingBucket) {
    const { error: createError } = await svc.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
    if (createError) return NextResponse.json({ error: `Erro ao preparar armazenamento: ${createError.message}` }, { status: 500 });
  } else if (existingBucket.public) {
    // Corrige instalações anteriores que criaram o bucket como público —
    // documentos de KYC nunca podem ficar acessíveis sem autenticação.
    await svc.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
  }

  const ext      = sanitizeSegment(file.name.split(".").pop() ?? "bin");
  const safeName = `${token}/${Date.now()}_${sanitizeSegment(label)}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await svc.storage
    .from(BUCKET)
    .upload(safeName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: `Erro ao enviar arquivo: ${uploadError.message}` }, { status: 500 });

  // URL assinada de curta duração — só para o formulário confirmar visualmente
  // o envio. O caminho (path) é o valor real usado depois no submit.
  const { data: signedData } = await svc.storage.from(BUCKET).createSignedUrl(uploadData.path, SIGNED_URL_EXPIRES);

  return NextResponse.json({ ok: true, url: signedData?.signedUrl ?? null, path: uploadData.path, name: file.name });
}

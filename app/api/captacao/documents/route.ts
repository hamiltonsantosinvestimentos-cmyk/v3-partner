import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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

  // Garante que o bucket existe (cria se necessário) — evita falha silenciosa
  // de upload quando o bucket ainda não foi provisionado no projeto Supabase.
  const { data: buckets } = await svc.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === "captacao-documents");
  if (!bucketExists) {
    const { error: createError } = await svc.storage.createBucket("captacao-documents", { public: true, fileSizeLimit: 10 * 1024 * 1024 });
    if (createError) return NextResponse.json({ error: `Erro ao preparar armazenamento: ${createError.message}` }, { status: 500 });
  }

  const ext      = file.name.split(".").pop() ?? "bin";
  const safeName = `${token}/${Date.now()}_${label.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await svc.storage
    .from("captacao-documents")
    .upload(safeName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: `Erro ao enviar arquivo: ${uploadError.message}` }, { status: 500 });

  const { data: { publicUrl } } = svc.storage
    .from("captacao-documents")
    .getPublicUrl(uploadData.path);

  return NextResponse.json({ ok: true, url: publicUrl, path: uploadData.path, name: file.name });
}

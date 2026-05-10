import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  const supplierId = req.headers.get("x-supplier-id");
  if (!supplierId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();

  // Validate supplier
  const { data: supplier } = await svc
    .from("marketplace_suppliers")
    .select("id, status")
    .eq("id", supplierId)
    .single();

  if (!supplier) return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "image" or "attachment"

  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const isImage = type === "image";
  const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_DOC_TYPES;
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `Tipo de arquivo não permitido: ${file.type}` }, { status: 400 });
  }

  if (file.size > maxSize) {
    return NextResponse.json({ error: `Arquivo muito grande. Máximo ${isImage ? "5MB" : "20MB"}` }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const folder = isImage ? "images" : "attachments";
  const path = `products/${folder}/${supplierId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await svc.storage
    .from("marketplace")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = svc.storage.from("marketplace").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, name: file.name, path });
}

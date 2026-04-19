import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const BUCKET = "avatars";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

  // Validações
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WEBP ou GIF." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 5MB." }, { status: 400 });
  }

  const svc = serviceClient();

  // Garante que o bucket existe (cria se necessário)
  const { data: buckets } = await svc.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === BUCKET);
  if (!bucketExists) {
    await svc.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5242880 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/avatar_${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await svc.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = svc.storage.from(BUCKET).getPublicUrl(path);

  // Atualiza avatar_url no profile
  const { error: updateError } = await svc
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, avatar_url: publicUrl });
}

// DELETE — remove avatar
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  await svc.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}

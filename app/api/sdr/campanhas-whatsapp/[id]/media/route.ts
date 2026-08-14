import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const BUCKET = "sdr-media";
const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_SIZE = 16 * 1024 * 1024; // 16MB

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user };
}

// POST /api/sdr/campanhas-whatsapp/[id]/media — sobe imagem/vídeo e vincula à campanha
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

  const isImage = ALLOWED_IMAGE.includes(file.type);
  const isVideo = ALLOWED_VIDEO.includes(file.type);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WEBP, GIF (imagem) ou MP4, MOV, WEBM (vídeo)." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 16MB." }, { status: 400 });
  }

  const db = svc();

  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some(b => b.name === BUCKET)) {
    await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE });
  }

  const ext = file.name.split(".").pop() ?? (isImage ? "jpg" : "mp4");
  const path = `${id}/midia_${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
  const mediaType = isImage ? "image" : "video";

  const { error: updateErr } = await db
    .from("sdr_campanhas_whatsapp")
    .update({ media_url: publicUrl, media_type: mediaType })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, media_url: publicUrl, media_type: mediaType });
}

// DELETE /api/sdr/campanhas-whatsapp/[id]/media — remove a mídia vinculada à campanha
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const { error } = await svc()
    .from("sdr_campanhas_whatsapp")
    .update({ media_url: null, media_type: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

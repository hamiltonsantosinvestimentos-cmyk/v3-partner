import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

type GalleryItem = { storage_path: string; caption: string; order: number };

// POST — upload de imagem higienizada para a galeria publica do ativo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const { id } = await params;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, public_gallery")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) || "";

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 422 });
  if (!IMAGE_TYPES.includes(file.type))
    return NextResponse.json({ error: "Formato inválido — envie JPEG, PNG ou WEBP" }, { status: 422 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Imagem acima de 8MB" }, { status: 422 });

  const filename = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `cm-documents/${listing.anonymous_id}/galeria/${Date.now()}-${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await svc().storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 });

  const current: GalleryItem[] = Array.isArray(listing.public_gallery) ? listing.public_gallery : [];
  const nextItem: GalleryItem = { storage_path: storagePath, caption, order: current.length };
  const updatedGallery = [...current, nextItem];

  const { error: updateError } = await svc()
    .from("cm_asset_listings")
    .update({ public_gallery: updatedGallery })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ gallery: updatedGallery }, { status: 201 });
}

// DELETE — remove uma imagem da galeria (?storage_path=...)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const { id } = await params;
  const storagePath = req.nextUrl.searchParams.get("storage_path");
  if (!storagePath) return NextResponse.json({ error: "storage_path obrigatório" }, { status: 422 });

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, public_gallery")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  await svc().storage.from("documents").remove([storagePath]);

  const current: GalleryItem[] = Array.isArray(listing.public_gallery) ? listing.public_gallery : [];
  const updatedGallery = current
    .filter((item) => item.storage_path !== storagePath)
    .map((item, i) => ({ ...item, order: i }));

  const { error: updateError } = await svc()
    .from("cm_asset_listings")
    .update({ public_gallery: updatedGallery })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ gallery: updatedGallery });
}

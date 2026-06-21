import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await svc()
    .from("cm_listing_documents")
    .select("*")
    .eq("listing_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = formData.get("document_type") as string || "outro";

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 422 });

  const filename = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `cm-documents/${listing.anonymous_id}/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await svc().storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 });

  const { data: doc, error: insertError } = await svc()
    .from("cm_listing_documents")
    .insert({
      listing_id: id,
      document_type: documentType,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      validation_status: "pendente",
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const AUDIO_TYPES = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/webm"];
  const isAudio = AUDIO_TYPES.includes(file.type) || /\.(mp3|ogg|wav|m4a|webm)$/i.test(file.name);
  const isPdf = file.type === "application/pdf";

  if (process.env.N8N_WEBHOOK_URL) {
    const webhookPath = isAudio ? "v3-cm-audio-intake" : isPdf ? "v3-doc-extract-large" : null;
    if (webhookPath) {
      try {
        await fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/${webhookPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extraction_id: doc.id,
            storage_path: storagePath,
            bucket: "documents",
            listing_id: id,
            anonymous_id: listing.anonymous_id,
            source: "cm_marketplace",
            file_type: isAudio ? "audio" : "pdf",
            original_filename: file.name,
          }),
        });
      } catch (webhookErr) {
        console.error(`[CM Documents] ${webhookPath} webhook failed:`, webhookErr);
      }
    }
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}

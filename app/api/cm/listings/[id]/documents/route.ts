import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const PARTNER_ROLES = ["PARTNER", "PARTNER_PRO", "STARTER", "ENTERPRISE"];

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

// Checa posse: interno (ADMIN/GESTAO/MESA_OPERACIONAL) sempre passa; Partner so passa se for
// o originator_profile_id daquele listing especifico. Achado 13/08/2026: antes desta checagem,
// QUALQUER usuario autenticado conseguia ler/gravar documento de QUALQUER listing_id, sem
// verificar posse nenhuma -- gap de autorizacao real, corrigido no mesmo commit que libera
// acesso pro Partner (nao só um "adicionar Partner", um fechamento de gap pre-existente).
async function assertOwnership(caller: { userId: string; role: string }, listingId: string): Promise<boolean> {
  if (ALLOWED_ROLES.includes(caller.role)) return true;
  if (!PARTNER_ROLES.includes(caller.role)) return false;
  const { data: listing } = await svc().from("cm_asset_listings").select("originator_profile_id").eq("id", listingId).maybeSingle();
  return !!listing && listing.originator_profile_id === caller.userId;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  if (!(await assertOwnership(caller, id))) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data, error } = await svc()
    .from("cm_listing_documents")
    .select("*")
    .eq("listing_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const documentsWithUrls = await Promise.all(
    (data ?? []).map(async (doc) => {
      const { data: signedUrl } = await svc().storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 3600);
      return { ...doc, download_url: signedUrl?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ documents: documentsWithUrls });
}

// POST — registra metadados em cm_listing_documents após upload direto ao Storage
// via signed URL (GET /documents/upload-url). O corpo já não carrega o arquivo:
// isso contorna o limite de body do Vercel serverless (~4.5MB).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  if (!(await assertOwnership(caller, id))) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  const body = await req.json() as {
    storage_path: string;
    original_filename: string;
    file_size_bytes?: number;
    content_type?: string;
    document_type?: string;
    checklist_item_id?: string | null;
  };

  const { storage_path: storagePath, original_filename: originalFilename } = body;
  if (!storagePath || !originalFilename) {
    return NextResponse.json({ error: "storage_path e original_filename são obrigatórios" }, { status: 422 });
  }

  const documentType = body.document_type || "outro";
  const checklistItemId = body.checklist_item_id || null;

  const { data: doc, error: insertError } = await svc()
    .from("cm_listing_documents")
    .insert({
      listing_id: id,
      document_type: documentType,
      storage_path: storagePath,
      original_filename: originalFilename,
      file_size_bytes: body.file_size_bytes ?? null,
      validation_status: "pendente",
      checklist_item_id: checklistItemId,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const AUDIO_TYPES = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/webm"];
  const isAudio = AUDIO_TYPES.includes(body.content_type ?? "") || /\.(mp3|ogg|wav|m4a|webm)$/i.test(originalFilename);
  const isPdf = body.content_type === "application/pdf" || /\.pdf$/i.test(originalFilename);

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
            original_filename: originalFilename,
          }),
        });
      } catch (webhookErr) {
        console.error(`[CM Documents] ${webhookPath} webhook failed:`, webhookErr);
      }
    }
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { findValidKycDocument, kycValidUntil, type KycDocumentKind } from "@/lib/kyc-documents";
import type { LegalQualificationRepresentation } from "@/lib/legal-qualification";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const DOC_KINDS: KycDocumentKind[] = ["identificacao_foto", "contrato_social"];

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id };
}

interface DocumentCard {
  document_kind: KycDocumentKind;
  original_filename: string | null;
  mime_type: string | null;
  uploaded_at: string;
  valid_until: string;
  download_url: string | null;
}

// Para um v3_client_id, resolve os documentos válidos (0-2, um por kind) com URL
// assinada (1h) e registra o acesso na trilha de auditoria — mesmo padrão de
// cm_deal_room_document_views (compliance exige log de toda visualização de KYC).
async function loadDocumentsForClient(db: SupabaseClient, v3ClientId: string, viewedBy: string, ip: string): Promise<DocumentCard[]> {
  const cards: DocumentCard[] = [];
  for (const kind of DOC_KINDS) {
    const doc = await findValidKycDocument(db, v3ClientId, kind);
    if (!doc) continue;
    const { data: signed } = await db.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
    cards.push({
      document_kind: kind,
      original_filename: doc.original_filename,
      mime_type: doc.mime_type,
      uploaded_at: doc.uploaded_at,
      valid_until: kycValidUntil(doc.uploaded_at),
      download_url: signed?.signedUrl ?? null,
    });
    await db.from("cm_party_qualification_document_views").insert({
      document_id: doc.id,
      viewed_by: viewedBy,
      ip_address: ip,
    });
  }
  return cards;
}

// Achata a cadeia recursiva de representação (representante, representante do
// representante, ...) em uma lista plana com profundidade, para o card exibir em
// sequência sem o front precisar entender a recursão.
async function loadRepresentationChain(db: SupabaseClient, rep: LegalQualificationRepresentation | null | undefined, viewedBy: string, ip: string, depth = 0): Promise<any[]> {
  if (!rep || depth > 5) return [];
  const documents = rep.v3_client_id ? await loadDocumentsForClient(db, rep.v3_client_id, viewedBy, ip) : [];
  const nested = await loadRepresentationChain(db, rep.representation, viewedBy, ip, depth + 1);
  return [{ depth, ...rep, documents }, ...nested];
}

/** GET /api/cm/qualifications/party/[id] — ficha civil completa de uma parte já
 *  qualificada, com os documentos de KYC válidos (reaproveitados ou próprios desta
 *  operação) e a cadeia de representação recursiva. Toda abertura registra log de
 *  acesso por documento efetivamente exibido (compliance). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = svc();

  const { data: qualification, error } = await db
    .from("cm_party_qualifications")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !qualification) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404 });

  if (qualification.status !== "preenchido") {
    return NextResponse.json({ qualification, documents: [], representation_chain: [], filled: false });
  }

  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? _req.headers.get("x-real-ip") ?? "unknown";

  const documents = qualification.v3_client_id
    ? await loadDocumentsForClient(db, qualification.v3_client_id, caller.userId, ip)
    : [];

  const representationChain = await loadRepresentationChain(db, qualification.representation, caller.userId, ip);

  return NextResponse.json({ qualification, documents, representation_chain: representationChain, filled: true });
}

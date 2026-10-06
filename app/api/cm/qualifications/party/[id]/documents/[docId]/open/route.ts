import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { findValidKycDocument, type KycDocumentKind } from "@/lib/kyc-documents";

// Abertura de documento KYC da ficha (Passo 3, 05/10/2026). A foto fica escondida até o olho. O link
// assinado (60 segundos) só sai DEPOIS de o log em cm_party_qualification_document_views ser gravado
// com await; se o log falhar, nada é devolvido. Nunca usar `void db...insert()`: o builder do
// supabase-js não envia a requisição sem await.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const SIGNED_URL_SECONDS = 60;
const NO_STORE = { "Cache-Control": "no-store" };
const NOT_FOUND = () => NextResponse.json({ error: "Documento não encontrado" }, { status: 404, headers: NO_STORE });

/** v3_client_id da parte principal e de toda a cadeia de representação (recursiva). */
function collectClientIds(rep: any, acc: Set<string> = new Set(), depth = 0): Set<string> {
  if (!rep || depth > 6) return acc;
  if (typeof rep.v3_client_id === "string") acc.add(rep.v3_client_id.toLowerCase());
  return collectClientIds(rep.representation, acc, depth + 1);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });
  }

  const { id, docId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(docId)) return NOT_FOUND();

  const { data: q } = await db
    .from("cm_party_qualifications")
    .select("id, status, deleted_at, v3_client_id, representation")
    .eq("id", id)
    .maybeSingle();
  if (!q || q.deleted_at || q.status !== "preenchido") return NOT_FOUND();

  // O documento precisa pertencer a um cliente desta própria qualificação (principal ou cadeia).
  const allowedClients = collectClientIds(q.representation);
  if (typeof q.v3_client_id === "string") allowedClients.add(q.v3_client_id.toLowerCase());

  const { data: doc } = await db
    .from("cm_party_qualification_documents")
    .select("id, v3_client_id, document_kind, storage_path, mime_type")
    .eq("id", docId)
    .maybeSingle();
  if (!doc || !allowedClients.has(String(doc.v3_client_id).toLowerCase())) return NOT_FOUND();

  // Só o documento vigente do tipo. Um id antigo, já substituído ou vencido, dá 404.
  const current = await findValidKycDocument(db, doc.v3_client_id, doc.document_kind as KycDocumentKind);
  if (!current || current.id !== doc.id) return NOT_FOUND();

  // Limite de taxa contado no próprio log (a Vercel tem várias instâncias, contador em memória não vale).
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await db
    .from("cm_party_qualification_document_views")
    .select("id", { count: "exact", head: true })
    .eq("viewed_by", user.id)
    .gte("viewed_at", since);
  if (countError) {
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: "Muitas aberturas de documento em pouco tempo, aguarde alguns minutos" }, { status: 429, headers: NO_STORE });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  // Log ANTES do link. Falhou, nada sai.
  const { error: logError } = await db.from("cm_party_qualification_document_views").insert({
    document_id: doc.id,
    viewed_by: user.id,
    ip_address: ip,
    qualification_id: id,
  });
  if (logError) {
    console.error("[qualificacao documento open] falha ao gravar log de abertura", { qualification_id: id, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const { data: signed, error: signError } = await db.storage.from("documents").createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Não foi possível abrir o documento, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ url: signed.signedUrl, expires_in: SIGNED_URL_SECONDS, mime_type: doc.mime_type }, { headers: NO_STORE });
}

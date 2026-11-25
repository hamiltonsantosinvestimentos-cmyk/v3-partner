import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { logAuditStrict, getClientIp } from "@/lib/audit";
import {
  podeAcessarDeal, podeExcluir, documentosVisiveis, checarCategoria, podeSubstituir, ehEquipeDocumentos,
  LINK_DOCUMENTO_SEGUNDOS, MSG_SEM_PERMISSAO, MSG_SEM_PERMISSAO_EXCLUIR,
} from "@/lib/ma/acesso-documentos";

// Acesso por papel e por dono do deal (BRIEF docs/briefs/2026-11-24_ma-documents-acesso-por-papel-e-dono.md).
// Antes desta regra a rota só exigia login: qualquer usuário lia, enviava e apagava documentos de qualquer deal.

export const dynamic = "force-dynamic";

const DEFAULT_BUCKET = "ma-documents";
const GOVERNED_BUCKET = "v3-docs-publico";
const SIGNED_URL_EXPIRES = LINK_DOCUMENTO_SEGUNDOS; // era 20 dias

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  // Papel lido com a chave de serviço (decide o acesso): pela sessão, a RLS de profiles poderia devolver vazio.
  const { data: profile } = await serviceClient().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
  bucket?: string;
  file_hash?: string;
  category?: string;
};

function resolveBucket(doc: DocEntry): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path.startsWith("MA/") || doc.storage_path.startsWith("Credito/") || doc.storage_path.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

// POST — upload de documento
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData  = await req.formData();
  const file      = formData.get("file")    as File   | null;
  const dealId    = formData.get("deal_id") as string | null;
  const docId     = formData.get("doc_id")  as string | null;
  const category  = (formData.get("category") as string | null) ?? "Due_Diligence";

  if (!file || !dealId || !docId) {
    return NextResponse.json({ error: "Campos obrigatórios: file, deal_id, doc_id" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, documents, assigned_to, created_by, deleted_at")
    .eq("id", dealId)
    .maybeSingle();

  // Equipe recebe 404 para deal inexistente; os demais recebem 403 sem saber se o deal existe.
  if (!deal && ehEquipeDocumentos(profile?.role)) return NextResponse.json({ error: "Operação M&A não encontrada" }, { status: 404 });
  if (!deal || !podeAcessarDeal(profile?.role, deal, user.id)) {
    return NextResponse.json({ error: MSG_SEM_PERMISSAO }, { status: 403 });
  }

  const cat = checarCategoria(profile?.role, category);
  if (!cat.ok) return NextResponse.json({ error: cat.erro }, { status: cat.status });

  const equipe = ehEquipeDocumentos(profile?.role);

  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${dealId}/${docId}_${Date.now()}_${safeName}`;

  const bytes = await file.arrayBuffer();
  const fileHash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");

  const { data: duplicateRow } = await svc
    .from("ma_documents")
    .select("id, doc_id, file_name, storage_path, bucket, uploaded_at")
    .eq("deal_id", dealId)
    .eq("file_hash", fileHash)
    .limit(1)
    .maybeSingle();

  if (duplicateRow) {
    // Arquivo igual já existe no deal. Ao perfil não equipe o link e o caminho não saem: o arquivo
    // existente pode ter sido enviado pela equipe (duplo cego).
    if (!equipe) {
      return NextResponse.json({ ok: true, duplicate: true, document: { doc_id: duplicateRow.doc_id, uploaded_at: duplicateRow.uploaded_at } });
    }
    const { data: existingSigned } = await svc.storage
      .from(duplicateRow.bucket)
      .createSignedUrl(duplicateRow.storage_path, SIGNED_URL_EXPIRES);
    return NextResponse.json({
      ok: true,
      duplicate: true,
      document: {
        doc_id: duplicateRow.doc_id,
        file_name: duplicateRow.file_name,
        storage_path: duplicateRow.storage_path,
        uploaded_at: duplicateRow.uploaded_at,
        url: existingSigned?.signedUrl ?? null,
      },
    });
  }

  const existingDocs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];
  const oldDoc = existingDocs.find((d) => d.doc_id === docId);
  if (!podeSubstituir(profile?.role, oldDoc, user.id)) {
    return NextResponse.json({ error: "Este documento foi enviado por outro usuário e não pode ser substituído." }, { status: 409 });
  }
  if (oldDoc) {
    // Substituição: o log é gravado antes da remoção; se não gravar, nada é removido.
    try {
      await logAuditStrict({
        userId: user.id, userName: profile?.full_name, action: "UPDATE", entity: "ma_deals", entityId: dealId,
        oldData: { substituiu_doc_id: oldDoc.doc_id, storage_path: oldDoc.storage_path, bucket: resolveBucket(oldDoc), file_name: oldDoc.file_name },
        newData: { documento: { doc_id: docId, file_name: file.name } }, ipAddress: getClientIp(req),
      });
    } catch (e) {
      console.error("[ma/documents POST] auditoria da substituição falhou:", e);
      return NextResponse.json({ error: "Não foi possível registrar a substituição. Nada foi alterado." }, { status: 500 });
    }
    await svc.storage.from(resolveBucket(oldDoc)).remove([oldDoc.storage_path]);
  } else {
    // Envio novo: log gravado antes de gravar o arquivo; se não gravar, o envio não acontece.
    try {
      await logAuditStrict({
        userId: user.id, userName: profile?.full_name, action: "CREATE", entity: "ma_deals", entityId: dealId,
        newData: { documento: { doc_id: docId, file_name: file.name, category } }, ipAddress: getClientIp(req),
      });
    } catch (e) {
      console.error("[ma/documents POST] auditoria do envio falhou:", e);
      return NextResponse.json({ error: "Não foi possível registrar o envio. Tente novamente." }, { status: 500 });
    }
  }

  const { error: uploadError } = await svc.storage
    .from(DEFAULT_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Erro no storage: ${uploadError.message}` }, { status: 500 });
  }

  const { data: signedData } = await svc.storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

  const newDoc: DocEntry = {
    doc_id:       docId,
    file_name:    file.name,
    storage_path: storagePath,
    bucket:       DEFAULT_BUCKET,
    category,
    file_hash:    fileHash,
    uploaded_at:  new Date().toISOString(),
    uploaded_by:  user.id,
  };
  const updatedDocs = [...existingDocs.filter((d) => d.doc_id !== docId), newDoc];

  const { error: updateError } = await svc
    .from("ma_deals")
    .update({ documents: updatedDocs })
    .eq("id", dealId);

  if (updateError) {
    await svc.storage.from(DEFAULT_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: `Erro ao salvar no banco: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: { ...newDoc, url: signedData?.signedUrl ?? null },
  });
}

// GET — lista documentos da operação com signed URLs
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, documents, assigned_to, created_by, deleted_at")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal && ehEquipeDocumentos(profile?.role)) return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });
  if (!deal || !podeAcessarDeal(profile?.role, deal, user.id)) {
    return NextResponse.json({ error: MSG_SEM_PERMISSAO }, { status: 403 });
  }

  // Recorte (duplo cego): quem não é equipe recebe só os documentos que ele mesmo enviou.
  const docs: DocEntry[] = documentosVisiveis(profile?.role, Array.isArray(deal.documents) ? deal.documents : [], user.id);

  // Log gravado antes de gerar qualquer link; se não gravar, nenhum link sai.
  try {
    await logAuditStrict({
      userId: user.id, userName: profile?.full_name, action: "ACCESS", entity: "ma_deals", entityId: dealId,
      newData: { documentos_listados: docs.length, papel: profile?.role ?? null }, ipAddress: getClientIp(req),
    });
  } catch (e) {
    console.error("[ma/documents GET] auditoria falhou:", e);
    return NextResponse.json({ error: "Não foi possível registrar o acesso. Tente novamente." }, { status: 500 });
  }

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const bucket = resolveBucket(doc);
      const { data } = await svc.storage
        .from(bucket)
        .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRES);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ documents: docsWithUrls });
}

// DELETE — remove documento
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Só a equipe exclui documento (BRIEF 2026-11-24).
  if (!podeExcluir(profile?.role)) return NextResponse.json({ error: MSG_SEM_PERMISSAO_EXCLUIR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  const docId  = searchParams.get("doc_id");
  if (!dealId || !docId) {
    return NextResponse.json({ error: "deal_id e doc_id obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, documents")
    .eq("id", dealId)
    .single();

  if (!deal) return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });

  const docs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];
  const docToRemove = docs.find((d) => d.doc_id === docId);
  if (!docToRemove) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  // Log antes da remoção; se não gravar, nada é removido.
  try {
    await logAuditStrict({
      userId: user.id, userName: profile?.full_name, action: "DELETE", entity: "ma_deals", entityId: dealId,
      oldData: { documento: { doc_id: docToRemove.doc_id, file_name: docToRemove.file_name, storage_path: docToRemove.storage_path, bucket: resolveBucket(docToRemove) } },
      ipAddress: getClientIp(req),
    });
  } catch (e) {
    console.error("[ma/documents DELETE] auditoria falhou:", e);
    return NextResponse.json({ error: "Não foi possível registrar a exclusão. Nada foi removido." }, { status: 500 });
  }

  await svc.storage.from(resolveBucket(docToRemove)).remove([docToRemove.storage_path]);

  const updatedDocs = docs.filter((d) => d.doc_id !== docId);
  await svc.from("ma_deals").update({ documents: updatedDocs }).eq("id", dealId);

  return NextResponse.json({ ok: true });
}

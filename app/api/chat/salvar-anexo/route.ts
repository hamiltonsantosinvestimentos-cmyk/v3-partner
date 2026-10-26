import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { ANEXOS_BUCKET, ehMesa, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";
const BUCKET_PROPOSTAS = "credit-documents";

// POST { path, nome, proposal_id } — a Mesa copia um anexo do chat para os documentos da
// proposta (mesmo formato do upload livre do modal: doc_id "anexo_<ts>", bucket credit-documents).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: me } = await db.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!ehMesa(me?.role as string)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { path, nome, proposal_id } = (await req.json().catch(() => ({}))) as { path?: string; nome?: string; proposal_id?: string };
  if (!path || !proposal_id) return NextResponse.json({ error: "Escolha a proposta" }, { status: 400 });

  const { data: prop } = await db.from("credit_desk_proposals").select("id, code, partner_id, documents").eq("id", proposal_id).single();
  if (!prop) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  // O anexo tem que ser da sala do partner dono da proposta
  if (prop.partner_id && !path.startsWith(`partner_${prop.partner_id}/`)) {
    return NextResponse.json({ error: "Este anexo é de outra conversa" }, { status: 400 });
  }

  const { data: arquivo, error: dErr } = await db.storage.from(ANEXOS_BUCKET).download(path);
  if (dErr || !arquivo) return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });

  const nomeArq = (nome || path.split("/").pop() || "anexo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const docId = `anexo_${Date.now()}`;
  const destino = `${prop.partner_id ?? user.id}/${proposal_id}/${docId}_${Date.now()}_${nomeArq}`;
  const { error: uErr } = await db.storage.from(BUCKET_PROPOSTAS).upload(destino, await arquivo.arrayBuffer(), { contentType: arquivo.type || "application/octet-stream" });
  if (uErr) return NextResponse.json({ error: `Erro no storage: ${uErr.message}` }, { status: 500 });

  const docs = Array.isArray(prop.documents) ? prop.documents : [];
  const novo = { doc_id: docId, file_name: nome || nomeArq, storage_path: destino, uploaded_at: new Date().toISOString(), uploaded_by: user.id, origem: "chat" };
  const { error: upErr } = await db.from("credit_desk_proposals").update({ documents: [...docs, novo] }).eq("id", proposal_id);
  if (upErr) {
    await db.storage.from(BUCKET_PROPOSTAS).remove([destino]);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  logAudit({ userId: user.id, userName: me?.full_name as string, action: "CREATE", entity: "credit_documents" as never, entityId: proposal_id, newData: { doc_id: docId, file_name: novo.file_name, origem: "chat" } });
  return NextResponse.json({ ok: true, proposta: prop.code });
}

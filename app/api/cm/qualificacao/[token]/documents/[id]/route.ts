import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** DELETE /api/cm/qualificacao/[token]/documents/[id] — remove um documento que a própria
 *  parte enviou por engano, ANTES do submit final, para reenviar o correto. Só apaga
 *  documento que pertence a esta qualificação (uploaded_by_qualification_id), nunca um
 *  documento reaproveitado de operação anterior (esse não tem vínculo com este token e
 *  continua servindo outras qualificações do mesmo CPF/CNPJ). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const db = svc();

  const { data: qualification } = await db
    .from("cm_party_qualifications")
    .select("id, status")
    .eq("qualification_token", token)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  if (qualification.status === "preenchido") {
    return NextResponse.json({ error: "Este link já foi preenchido." }, { status: 409 });
  }

  const { data: doc } = await db
    .from("cm_party_qualification_documents")
    .select("id, storage_path, uploaded_by_qualification_id")
    .eq("id", id)
    .single();

  if (!doc || doc.uploaded_by_qualification_id !== qualification.id) {
    return NextResponse.json({ error: "Documento não encontrado para esta qualificação." }, { status: 404 });
  }

  await db.storage.from("documents").remove([doc.storage_path]);
  const { error } = await db.from("cm_party_qualification_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

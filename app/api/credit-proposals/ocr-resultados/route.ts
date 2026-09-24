import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { atualizarMetadata } from "@/lib/credit-proposal-meta";

// DELETE /api/credit-proposals/ocr-resultados?proposal_id=&doc_id=[&file_key=]
// Remove o resultado de OCR de um arquivo (chave "docId::fileKey") ou de todos os arquivos de
// um documento, direto no banco — sem regravar o metadata inteiro a partir do modal.

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposal_id");
  const docId = searchParams.get("doc_id");
  const fileKey = searchParams.get("file_key");
  if (!proposalId || !docId) return NextResponse.json({ error: "proposal_id e doc_id obrigatórios" }, { status: 400 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const r = await atualizarMetadata(db, proposalId, (meta) => {
    const ocr = { ...((meta.ocr_resultados ?? {}) as Record<string, unknown>) };
    for (const k of Object.keys(ocr)) {
      const doArquivo = fileKey ? k === `${docId}::${fileKey}` : k === docId || k.startsWith(`${docId}::`);
      if (doArquivo) delete ocr[k];
    }
    return { ...meta, ocr_resultados: ocr };
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, metadata: r.metadata });
}

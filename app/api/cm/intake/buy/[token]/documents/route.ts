import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/cm/intake/buy/[token]/documents — lista documentos ja anexados (para retomar o wizard) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id")
    .eq("intake_token", token)
    .single();

  if (!demand) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  const { data, error } = await svc()
    .from("investor_demand_documents")
    .select("id, document_type, original_filename, created_at")
    .eq("demand_id", demand.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

/** POST /api/cm/intake/buy/[token]/documents — upload publico de LOI/MOU ou procuracao, gated pelo token
 *  Deliberadamente NAO checa intake_locked: o wizard sempre disse "pode enviar agora ou depois", mas
 *  ate 12/08/2026 essa promessa era falsa (o form principal trava o token e o upload trava junto, sem
 *  nenhum caminho de volta). Documento e sempre um anexo aberto, independente do formulario principal
 *  ja ter sido enviado -- so o token precisar existir e ser valido. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id")
    .eq("intake_token", token)
    .single();

  if (!demand) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = (formData.get("document_type") as string) || "outro";

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 422 });
  if (!["loi_mou", "procuracao", "outro"].includes(documentType)) {
    return NextResponse.json({ error: "document_type inválido" }, { status: 422 });
  }

  const filename = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `investor-documents/${demand.id}/${documentType}_${Date.now()}_${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await svc().storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 });

  const { data: doc, error: insertError } = await svc()
    .from("investor_demand_documents")
    .insert({
      demand_id: demand.id,
      document_type: documentType,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
    })
    .select("id, document_type, original_filename, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ document: doc }, { status: 201 });
}

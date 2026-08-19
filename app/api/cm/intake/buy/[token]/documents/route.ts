import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const DOC_TYPE_LABELS: Record<string, string> = {
  loi_mou: "LOI/MOU",
  procuracao: "Procuração",
  outro: "Outro",
  kyc_identidade: "KYC, Identidade (RG/CNH)",
  kyc_comprovante_residencia: "KYC, Comprovante de Residência",
  kyc_contrato_social: "KYC, Contrato Social",
};

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
    .select("id, nome_contato, origin_partner_id")
    .eq("intake_token", token)
    .single();

  if (!demand) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = (formData.get("document_type") as string) || "outro";

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 422 });
  if (!["loi_mou", "procuracao", "outro", "kyc_identidade", "kyc_comprovante_residencia", "kyc_contrato_social"].includes(documentType)) {
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

  // Timeline da ficha (BRIEF 19/08/2026) -- nota de sistema, sem author_id humano
  // (is_system=true), visivel pra Mesa e pro Partner de origem na aba Timeline.
  void svc().from("cm_deal_notes").insert({
    demand_id: demand.id,
    content: `Documento anexado pelo comprador: ${DOC_TYPE_LABELS[documentType] ?? documentType} (${file.name}).`,
    is_system: true,
  });

  // Notifica o Partner que originou este comprador (push real + in-app) -- mesmo padrao do
  // sell-side (status/route.ts), fire-and-forget.
  if (demand.origin_partner_id) {
    void createNotification({
      user_id: demand.origin_partner_id,
      title: `${demand.nome_contato} enviou um documento`,
      message: `Novo documento (${DOC_TYPE_LABELS[documentType] ?? documentType}) no comprador que você indicou.`,
      type: "marketplace",
      action_url: "/meus-compradores",
    });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}

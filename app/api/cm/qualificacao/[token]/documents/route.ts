import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";
import { resolveClient } from "@/lib/v3-clients";
import {
  KYC_ALLOWED_MIME_TYPES, KYC_MAX_FILE_SIZE_BYTES,
  type KycDocumentKind,
} from "@/lib/kyc-documents";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID_KINDS: KycDocumentKind[] = ["identificacao_foto", "contrato_social"];

async function loadOpenQualification(token: string) {
  const { data: qualification } = await svc()
    .from("cm_party_qualifications")
    .select("id, batch_id, status")
    .eq("qualification_token", token)
    .single();
  if (!qualification) return { error: NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 }) };
  if (qualification.status === "preenchido") {
    return { error: NextResponse.json({ error: "Este link já foi preenchido." }, { status: 409 }) };
  }
  return { qualification };
}

/** GET /api/cm/qualificacao/[token]/documents — documentos enviados NESTA qualificação
 *  (não inclui documentos reaproveitados de operação anterior — esses vêm de
 *  /api/cm/kyc/check, que só confirma validade sem expor o arquivo em si no
 *  formulário público). Usado para restaurar o estado "já enviado" ao recarregar a página. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { qualification, error } = await loadOpenQualification(token);
  if (error) return error;

  const { data, error: dbError } = await svc()
    .from("cm_party_qualification_documents")
    .select("id, document_kind, owner_label, original_filename, uploaded_at")
    .eq("uploaded_by_qualification_id", qualification!.id)
    .order("uploaded_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

/** POST /api/cm/qualificacao/[token]/documents — upload de KYC (foto de ID ou contrato
 *  social) pela própria parte, ainda dentro do preenchimento (antes do submit final).
 *  Resolve v3_client_id no momento do upload (o CPF/CNPJ já foi digitado nesse ponto do
 *  formulário) e ancora o arquivo por identidade, nunca por esta qualificação isolada --
 *  é isso que permite reaproveitar o mesmo arquivo numa operação futura sem duplicar. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { qualification, error } = await loadOpenQualification(token);
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Formulário inválido" }, { status: 422 });

  const file = formData.get("file") as File | null;
  const documentKind = formData.get("document_kind") as string | null;
  const ownerLabel = (formData.get("owner_label") as string | null)?.trim() || null;
  const documentNumber = (formData.get("document_number") as string | null)?.trim() || "";

  if (!file || !documentKind || !VALID_KINDS.includes(documentKind as KycDocumentKind)) {
    return NextResponse.json({ error: "file e document_kind (identificacao_foto ou contrato_social) são obrigatórios" }, { status: 422 });
  }
  if (!KYC_ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato não aceito. Envie JPG, PNG ou PDF." }, { status: 422 });
  }
  if (file.size > KYC_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 15MB." }, { status: 422 });
  }

  const kind = documentKind as KycDocumentKind;
  if (kind === "identificacao_foto" && !isValidCPF(documentNumber)) {
    return NextResponse.json({ error: "CPF inválido para vincular o documento de identificação." }, { status: 422 });
  }
  if (kind === "contrato_social" && !isValidCNPJ(documentNumber)) {
    return NextResponse.json({ error: "CNPJ inválido para vincular o contrato social." }, { status: 422 });
  }

  const db = svc();
  const v3ClientId = await resolveClient(documentNumber, { vertical: "central_contratos", db });
  if (!v3ClientId) return NextResponse.json({ error: "Não foi possível vincular o documento ao CPF/CNPJ informado." }, { status: 500 });

  const safeFilename = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `cm-kyc/${v3ClientId}/${kind}_${Date.now()}_${safeFilename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await db.storage.from("documents").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 });

  const { data: doc, error: insertError } = await db
    .from("cm_party_qualification_documents")
    .insert({
      v3_client_id: v3ClientId,
      document_kind: kind,
      owner_label: ownerLabel,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      uploaded_by_qualification_id: qualification!.id,
    })
    .select("id, document_kind, owner_label, original_filename, uploaded_at")
    .single();

  if (insertError) {
    await db.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}

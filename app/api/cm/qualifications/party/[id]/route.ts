import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { findValidKycDocument, kycValidUntil, type KycDocumentKind } from "@/lib/kyc-documents";
import type { LegalQualificationRepresentation } from "@/lib/legal-qualification";
import { isValidEmail } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/qualification-roles";

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

/** DELETE /api/cm/qualifications/party/[id] — exclusão individual de um
 *  envolvido de qualificação antecipada (11/09/2026, pedido de João:
 *  dado errado/obsoleto num lote — ex: intermediário duplicado, parte que
 *  não deveria ter entrado nessa minuta — sem precisar apagar o lote
 *  inteiro). Soft delete: nunca some do banco, só sai de toda leitura
 *  ativa. Bloqueado se o lote já foi consumido por um contrato real
 *  (single-use por desenho, mesma trava de 11/09/2026 em generate/route.ts
 *  -- alterar retroativamente um lote já usado não protege nada e só
 *  confunde auditoria). Recalcula o status do lote: como só remove
 *  (nunca adiciona), uma remoção nunca torna um lote completo em
 *  incompleto -- só pode fazer um lote "coletando" virar "completo" se
 *  o envolvido removido era o único ainda pendente. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = svc();

  const { data: party, error } = await db
    .from("cm_party_qualifications")
    .select("id, full_name, batch_id, deleted_at")
    .eq("id", id)
    .single();

  if (error || !party) return NextResponse.json({ error: "Envolvido não encontrado" }, { status: 404 });
  if (party.deleted_at) return NextResponse.json({ error: "Este envolvido já foi excluído" }, { status: 409 });

  const { data: batch } = await db
    .from("cm_qualification_batches")
    .select("id, status, consumido_por_contract_id, consumido_contrato:consumido_por_contract_id(contract_code)")
    .eq("id", party.batch_id)
    .single();

  if (batch?.consumido_por_contract_id) {
    const codigo = (batch as unknown as { consumido_contrato?: { contract_code: string | null } | null }).consumido_contrato?.contract_code ?? "outro contrato já gerado";
    return NextResponse.json(
      { error: `Este lote já foi usado no contrato ${codigo}. Não é possível excluir envolvidos de um lote já consumido.` },
      { status: 409 }
    );
  }

  const { error: deleteError } = await db
    .from("cm_party_qualifications")
    .update({ deleted_at: new Date().toISOString(), deleted_by: caller.userId })
    .eq("id", id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (batch && batch.status === "coletando") {
    const { data: siblings } = await db
      .from("cm_party_qualifications")
      .select("status")
      .eq("batch_id", batch.id)
      .is("deleted_at", null);

    if ((siblings ?? []).length > 0 && (siblings ?? []).every((s) => s.status === "preenchido")) {
      await db.from("cm_qualification_batches").update({ status: "completo", completed_at: new Date().toISOString() }).eq("id", batch.id);
    }
  }

  return NextResponse.json({ ok: true, deleted_party: party.full_name });
}

/** PATCH /api/cm/qualifications/party/[id] — corrige só o dado
 *  ADMINISTRATIVO que a própria Mesa digitou na criação do envolvido (nome,
 *  e-mail, telefone, papel), 11/09/2026, pedido de João: "falta um botão
 *  de editar para corrigir qualificações erradas".
 *
 *  Deliberadamente NÃO edita CPF/RG/endereço/dados de PJ/representação --
 *  esses são autodeclarados pela própria parte via link público
 *  (/intake/qualificacao/[token]) e continuam só corrigíveis por "Reabrir
 *  para Correção" (POST .../reopen), pra preservar o rastro de quem
 *  atestou o quê. Editar esses campos direto pela Mesa apagaria essa
 *  distinção sem nenhum ganho real -- decisão confirmada com João antes de
 *  codar (não é limitação técnica, é escolha de governança). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { full_name, email, phone, role_in_document } = body as {
    full_name?: string; email?: string; phone?: string; role_in_document?: string;
  };

  if (full_name !== undefined && !full_name.trim()) {
    return NextResponse.json({ error: "Nome não pode ficar vazio" }, { status: 422 });
  }
  if (email !== undefined && !isValidEmail(email)) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 422 });
  }
  if (role_in_document !== undefined && !Object.keys(ROLE_LABELS).includes(role_in_document)) {
    return NextResponse.json({ error: "Papel no documento inválido" }, { status: 422 });
  }

  const db = svc();
  const { data: party, error: findError } = await db
    .from("cm_party_qualifications")
    .select("id, batch_id, deleted_at")
    .eq("id", id)
    .single();

  if (findError || !party) return NextResponse.json({ error: "Envolvido não encontrado" }, { status: 404 });
  if (party.deleted_at) return NextResponse.json({ error: "Este envolvido foi excluído, não pode ser editado" }, { status: 409 });

  const { data: batch } = await db
    .from("cm_qualification_batches")
    .select("consumido_por_contract_id, consumido_contrato:consumido_por_contract_id(contract_code)")
    .eq("id", party.batch_id)
    .single();

  if (batch?.consumido_por_contract_id) {
    const codigo = (batch as unknown as { consumido_contrato?: { contract_code: string | null } | null }).consumido_contrato?.contract_code ?? "outro contrato já gerado";
    return NextResponse.json(
      { error: `Este lote já foi usado no contrato ${codigo}. Não é possível editar envolvidos de um lote já consumido.` },
      { status: 409 }
    );
  }

  const updates: Record<string, any> = {};
  if (full_name !== undefined) updates.full_name = full_name.trim();
  if (email !== undefined) updates.email = email.trim();
  if (phone !== undefined) updates.phone = phone.trim() || null;
  if (role_in_document !== undefined) updates.role_in_document = role_in_document;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 422 });
  }

  const { data: updated, error: updateError } = await db
    .from("cm_party_qualifications")
    .update(updates)
    .eq("id", id)
    .select("id, full_name, email, phone, role_in_document")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ qualification: updated });
}

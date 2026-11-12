import type { SupabaseClient } from "@supabase/supabase-js";
import { findValidKycDocument, type KycDocumentKind } from "@/lib/kyc-documents";
import { flattenChain } from "@/lib/qualification-mask";
import { camposExigidos, declaracoesExigidas } from "@/lib/qualification-conferencia";

// Cálculo, no servidor, do que a conferência exige e do que o usuário já provou (BRIEF Trava de Liberação,
// seção 2.1). Os documentos exigidos são os MESMOS que a ficha mostra (principal e cada nó da cadeia, pelo
// v3_client_id, só os válidos e não excluídos). Nunca confia em lista vinda do navegador.

const DOC_KINDS: KycDocumentKind[] = ["identificacao_foto", "contrato_social"];

export type RowParaConferencia = {
  id: string;
  person_type?: string | null;
  v3_client_id?: string | null;
  filled_at?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  id_number?: string | null;
  representation?: unknown;
};

export type Exigidos = {
  documentos: { id: string; kind: KycDocumentKind; dono: string }[];
  campos: string[];
  declaracoes: string[];
};

export async function calcularExigidos(db: SupabaseClient, row: RowParaConferencia): Promise<Exigidos> {
  const documentos: Exigidos["documentos"] = [];
  const vistos = new Set<string>();
  const clientes: { id: string; dono: string }[] = [];
  if (row.v3_client_id) clientes.push({ id: row.v3_client_id, dono: "parte" });
  flattenChain(row.representation as Parameters<typeof flattenChain>[0]).forEach((no, i) => {
    if (no.v3_client_id) clientes.push({ id: String(no.v3_client_id), dono: `representante ${i + 1}` });
  });
  for (const c of clientes) {
    for (const kind of DOC_KINDS) {
      const doc = await findValidKycDocument(db, c.id, kind);
      if (doc && !vistos.has(doc.id)) {
        vistos.add(doc.id);
        documentos.push({ id: doc.id, kind, dono: c.dono });
      }
    }
  }
  return { documentos, campos: camposExigidos(row), declaracoes: declaracoesExigidas(row.person_type) };
}

export type Progresso = {
  documentos: { id: string; kind: KycDocumentKind; dono: string; aberto: boolean }[];
  campos: { field: string; revelado: boolean }[];
  completo: boolean;
};

/** O que ESTE usuário já abriu e revelou depois do preenchimento (a função de banco confere a mesma coisa). */
export async function calcularProgresso(db: SupabaseClient, row: RowParaConferencia, exigidos: Exigidos, userId: string): Promise<Progresso> {
  const desde = row.filled_at ?? "1970-01-01T00:00:00Z";
  let abertos = new Set<string>();
  if (exigidos.documentos.length > 0) {
    const { data } = await db
      .from("cm_party_qualification_document_views")
      .select("document_id")
      .eq("viewed_by", userId)
      .gt("viewed_at", desde)
      .in("document_id", exigidos.documentos.map((d) => d.id));
    abertos = new Set((data ?? []).map((v: { document_id: string }) => v.document_id));
  }
  let revelados = new Set<string>();
  if (exigidos.campos.length > 0) {
    const { data } = await db
      .from("cm_party_qualification_field_views")
      .select("field")
      .eq("qualification_id", row.id)
      .eq("viewed_by", userId)
      .gt("viewed_at", desde)
      .in("field", exigidos.campos);
    revelados = new Set((data ?? []).map((v: { field: string }) => v.field));
  }
  const documentos = exigidos.documentos.map((d) => ({ ...d, aberto: abertos.has(d.id) }));
  const campos = exigidos.campos.map((f) => ({ field: f, revelado: revelados.has(f) }));
  const completo = documentos.length > 0 && documentos.every((d) => d.aberto) && campos.every((c) => c.revelado);
  return { documentos, campos, completo };
}

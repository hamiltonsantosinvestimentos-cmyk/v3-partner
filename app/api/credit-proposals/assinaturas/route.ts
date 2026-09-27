import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  acessoProposta, COLUNAS, extensaoValida, MAX_BYTES, salvarArquivo, type DocAssinatura,
} from "@/lib/documentos-assinatura";

export const maxDuration = 60;

// GET  ?proposal_id= — documentos para assinatura da proposta (Mesa e partner da equipe)
// POST multipart { proposal_id, titulo, orientacao?, file } — Mesa sobe o arquivo que o cliente vai assinar

export async function GET(req: NextRequest) {
  const proposalId = new URL(req.url).searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });
  const a = await acessoProposta(proposalId);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const { data, error } = await a.db
    .from("credit_documentos_assinatura")
    .select(COLUNAS)
    .eq("proposal_id", proposalId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = (a.proposal.metadata ?? {}) as { email?: string };
  return NextResponse.json({
    documentos: (data ?? []) as DocAssinatura[],
    email_cliente_padrao: meta.email ?? null,
    pode_subir_original: a.mesa,
  });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  const proposalId = String(form.get("proposal_id") ?? "");
  const a = await acessoProposta(proposalId);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  if (!a.mesa) return NextResponse.json({ error: "Só a Mesa Operacional sobe o documento para assinatura." }, { status: 403 });

  const titulo = String(form.get("titulo") ?? "").trim().slice(0, 160);
  const orientacao = String(form.get("orientacao") ?? "").trim().slice(0, 2000) || null;
  const file = form.get("file");
  if (!titulo) return NextResponse.json({ error: "Informe o nome do documento." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Selecione o arquivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo maior que 20MB." }, { status: 413 });
  const ext = extensaoValida(file);
  if (!ext) return NextResponse.json({ error: "Envie PDF, Word (DOC/DOCX) ou imagem (JPG/PNG)." }, { status: 415 });

  const id = randomUUID();
  const path = `assinaturas/${proposalId}/${id}/original.${ext}`;
  const erroUp = await salvarArquivo(a.db, path, file);
  if (erroUp) return NextResponse.json({ error: `Falha ao salvar o arquivo: ${erroUp}` }, { status: 500 });

  const { data, error } = await a.db
    .from("credit_documentos_assinatura")
    .insert({ id, proposal_id: proposalId, titulo, orientacao, original_path: path, original_nome: file.name, criado_por: a.userId })
    .select(COLUNAS)
    .single();
  if (error) {
    await a.db.storage.from("credit-documents").remove([path]).catch(() => {});
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, documento: data });
}

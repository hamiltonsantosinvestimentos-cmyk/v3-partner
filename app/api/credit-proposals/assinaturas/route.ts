import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  acessoProposta, arquivosDoForm, caminhoArquivo, COLUNAS, extensaoValida, listarArquivos, MAX_BYTES, salvarArquivo, type DocAssinatura,
} from "@/lib/documentos-assinatura";

export const maxDuration = 60;

// GET  ?proposal_id= — documentos para assinatura da proposta (Mesa e partner da equipe)
// POST multipart { proposal_id, titulo, orientacao?, file (um ou vários) } — Mesa sobe o(s) arquivo(s)
//      que o cliente vai assinar; vários arquivos = um pacote só (um e-mail, um link, uma confirmação)

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
  const docs = (data ?? []) as DocAssinatura[];
  const comArquivos = await Promise.all(docs.map(async (d) => ({ ...d, arquivos: await listarArquivos(a.db, d) })));
  return NextResponse.json({
    documentos: comArquivos,
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
  const files = arquivosDoForm(form);
  if (!titulo) return NextResponse.json({ error: "Informe o nome do documento." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "Selecione o(s) arquivo(s)." }, { status: 400 });
  if (files.length > 15) return NextResponse.json({ error: "Envie no máximo 15 arquivos por vez." }, { status: 400 });
  for (const f of files) {
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `"${f.name}" é maior que 20MB.` }, { status: 413 });
    if (!extensaoValida(f)) return NextResponse.json({ error: `"${f.name}": envie PDF, Word (DOC/DOCX) ou imagem (JPG/PNG).` }, { status: 415 });
  }

  const id = randomUUID();
  const salvos: string[] = [];
  for (const [i, f] of files.entries()) {
    const path = caminhoArquivo(proposalId, id, "original", i + 1, f, extensaoValida(f)!);
    const erroUp = await salvarArquivo(a.db, path, f);
    if (erroUp) {
      if (salvos.length) await a.db.storage.from("credit-documents").remove(salvos).catch(() => {});
      return NextResponse.json({ error: `Falha ao salvar "${f.name}": ${erroUp}` }, { status: 500 });
    }
    salvos.push(path);
  }

  const { data, error } = await a.db
    .from("credit_documentos_assinatura")
    .insert({ id, proposal_id: proposalId, titulo, orientacao, original_path: salvos[0], original_nome: files[0].name, criado_por: a.userId })
    .select(COLUNAS)
    .single();
  if (error) {
    await a.db.storage.from("credit-documents").remove(salvos).catch(() => {});
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, documento: data });
}

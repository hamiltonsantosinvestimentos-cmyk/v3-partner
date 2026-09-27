import { NextRequest, NextResponse } from "next/server";
import {
  COLUNAS, extensaoValida, MAX_BYTES, notificarAssinatura, salvarArquivo, svcAssinatura, urlArquivo, type DocAssinatura,
} from "@/lib/documentos-assinatura";
import { marcaDoPerfil } from "@/lib/enterprise";

export const maxDuration = 60;

// Rota pública (sem login), protegida pelo token do link enviado ao cliente.
// GET               — dados do documento (título, orientação, situação) + marca
// GET ?baixar=1     — baixa o arquivo original (registra que o cliente baixou)
// POST multipart    — cliente sobe o arquivo assinado → notifica Mesa Operacional e partner

interface Params { params: Promise<{ token: string }> }

async function porToken(token: string) {
  const db = svcAssinatura();
  const { data } = await db.from("credit_documentos_assinatura").select(COLUNAS).eq("token", token).maybeSingle();
  const doc = data as DocAssinatura | null;
  if (!doc || doc.status === "cancelado") return { db, doc: null, erro: "Link inválido ou documento cancelado." };
  if (new Date(doc.token_expira_em) < new Date()) return { db, doc: null, erro: "Este link expirou. Peça um novo envio a quem mandou o documento." };
  return { db, doc, erro: null };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { db, doc, erro } = await porToken(token);
  if (!doc) return NextResponse.json({ error: erro }, { status: 404 });

  if (new URL(req.url).searchParams.get("baixar") === "1") {
    const url = await urlArquivo(db, doc.original_path, doc.original_nome);
    if (!url) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 500 });
    if (!doc.cliente_baixou_em) await db.from("credit_documentos_assinatura").update({ cliente_baixou_em: new Date().toISOString() }).eq("id", doc.id);
    return NextResponse.redirect(url);
  }

  const { data: prop } = await db.from("credit_desk_proposals").select("code, client_name, partner_id").eq("id", doc.proposal_id).single();
  const marca = prop?.partner_id ? await marcaDoPerfil(db, prop.partner_id as string) : null;
  return NextResponse.json({
    titulo: doc.titulo,
    orientacao: doc.orientacao,
    cliente: prop?.client_name ?? null,
    codigo: prop?.code ?? null,
    original_nome: doc.original_nome,
    ja_enviado: Boolean(doc.assinado_path),
    assinado_nome: doc.assinado_nome,
    expira_em: doc.token_expira_em,
    marca,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { db, doc, erro } = await porToken(token);
  if (!doc) return NextResponse.json({ error: erro }, { status: 404 });
  if (doc.status === "confirmado") return NextResponse.json({ error: "Este documento já foi recebido e confirmado. Se precisar reenviar, fale com quem mandou." }, { status: 409 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Selecione o arquivo assinado." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo maior que 20MB." }, { status: 413 });
  const ext = extensaoValida(file);
  if (!ext) return NextResponse.json({ error: "Envie o arquivo em PDF, JPG ou PNG." }, { status: 415 });

  const path = `assinaturas/${doc.proposal_id}/${doc.id}/assinado-${Date.now()}.${ext}`;
  const erroUp = await salvarArquivo(db, path, file);
  if (erroUp) return NextResponse.json({ error: "Falha ao salvar o arquivo. Tente novamente." }, { status: 500 });

  await db
    .from("credit_documentos_assinatura")
    .update({ assinado_path: path, assinado_nome: file.name, assinado_origem: "cliente", assinado_por: null, assinado_em: new Date().toISOString(), status: "assinado_recebido" })
    .eq("id", doc.id);

  const { data: prop } = await db.from("credit_desk_proposals").select("id, code, client_name, partner_id").eq("id", doc.proposal_id).single();
  if (prop) {
    await notificarAssinatura({
      proposal: { id: prop.id as string, code: prop.code as string | null, client_name: prop.client_name as string | null, partner_id: prop.partner_id as string | null },
      titulo: doc.titulo,
      evento: "cliente_subiu",
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

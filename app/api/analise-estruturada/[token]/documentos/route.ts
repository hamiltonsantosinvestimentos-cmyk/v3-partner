import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { pedidoPeloToken, statusDocumentos, registrarSeCompleto, pastaDoPedido } from "@/lib/analise-estruturada/documentos";
import {
  BUCKET_ANALISE, MAX_ARQUIVOS_POR_ITEM, CONTENT_TYPE_POR_EXTENSAO,
  extensaoDe, itemDoPerfil, perfilPeloDocumento,
} from "@/lib/analise-estruturada/checklist";

// Envio de documentos da Análise Estruturada V3 pelo cliente (rota pública, link do
// intake /intake/credit/<token>). Só responde para pedido pago do pacote Access.
// Upload em 2 passos (o corpo de uma função do Vercel tem limite de ~4,5 MB):
//   1. { acao: "url", key, nome_arquivo } → URL assinada de upload no storage
//   2. o navegador faz PUT do arquivo direto no storage
//   3. { acao: "confirmar" } → recalcula o checklist; ao completar os obrigatórios,
//      registra o início do prazo e dispara os alertas (uma vez só).

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface RouteParams { params: Promise<{ token: string }> }

function formatarStatus(s: Awaited<ReturnType<typeof statusDocumentos>>) {
  return {
    ativo: true,
    perfil: s.perfil,
    itens: s.itens.map((i) => ({
      key: i.key, label: i.label, descricao: i.descricao, obrigatorio: i.obrigatorio,
      arquivos: i.arquivos.map((a) => ({ nome: a.nome, enviado_em: a.enviado_em })),
    })),
    obrigatorios_faltando: s.obrigatoriosFaltando,
    completo: s.completo,
    completo_em: s.completoEm,
    prazo_entrega: s.prazoEntrega,
  };
}

async function consentimentoDado(db: ReturnType<typeof svc>, token: string): Promise<boolean> {
  const { data } = await db.from("credit_consents").select("status").eq("intake_token", token).maybeSingle();
  return !!data && data.status !== "pending";
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const db = svc();
  const pedido = await pedidoPeloToken(db, token);
  if (!pedido) return NextResponse.json({ ativo: false });
  const [status, consentido] = await Promise.all([statusDocumentos(db, pedido), consentimentoDado(db, token)]);
  return NextResponse.json({ ...formatarStatus(status), consentido });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const db = svc();
  const pedido = await pedidoPeloToken(db, token);
  if (!pedido) return NextResponse.json({ error: "Link inválido para envio de documentos." }, { status: 404 });
  if (!(await consentimentoDado(db, token))) {
    return NextResponse.json({ error: "Autorize a análise antes de enviar os documentos." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({})) as { acao?: string; key?: string; nome_arquivo?: string };

  if (body.acao === "url") {
    const perfil = perfilPeloDocumento(pedido.client_doc);
    const item = body.key ? itemDoPerfil(perfil, body.key) : undefined;
    if (!item) return NextResponse.json({ error: "Documento não reconhecido." }, { status: 400 });

    const nome = (body.nome_arquivo ?? "").trim();
    const ext = extensaoDe(nome);
    const contentType = CONTENT_TYPE_POR_EXTENSAO[ext];
    if (!nome || !contentType) {
      return NextResponse.json({ error: "Formato não aceito. Envie PDF, OFX, CSV, planilha (XLS/XLSX), Word ou imagem." }, { status: 415 });
    }

    const pasta = `${pastaDoPedido(pedido.id)}/${item.key}`;
    const { data: existentes } = await db.storage.from(BUCKET_ANALISE).list(pasta, { limit: MAX_ARQUIVOS_POR_ITEM + 1 });
    if ((existentes ?? []).filter((f) => f.id).length >= MAX_ARQUIVOS_POR_ITEM) {
      return NextResponse.json({ error: `Limite de ${MAX_ARQUIVOS_POR_ITEM} arquivos neste item.` }, { status: 422 });
    }

    const seguro = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
    const caminho = `${pasta}/${Date.now()}_${seguro}`;
    const { data: assinado, error } = await db.storage.from(BUCKET_ANALISE).createSignedUploadUrl(caminho);
    if (error || !assinado) return NextResponse.json({ error: "Não foi possível preparar o envio. Tente de novo." }, { status: 500 });
    return NextResponse.json({ url: assinado.signedUrl, content_type: contentType });
  }

  if (body.acao === "confirmar") {
    const status = await registrarSeCompleto(db, pedido);
    return NextResponse.json({ ...formatarStatus(status), consentido: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

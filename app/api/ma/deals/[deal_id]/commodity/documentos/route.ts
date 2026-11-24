import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit, getClientIp } from "@/lib/audit";
import {
  acessoCommodity, caminhoDocumento, caminhoPertenceAoDeal, documentosAtivos, podeExcluirDocumento,
  situacaoDocumentos, validarArquivo, extensao, ARQUIVO_MAX_BYTES, ARQUIVO_TIPOS_MIME, MSG_ARQUIVO_INVALIDO,
  TIPOS_DOCUMENTO, type CommodityGravada, type DocumentoComercial,
} from "@/lib/ma/commodity";

// Documentos comerciais do pedido de commodity (BRIEF 2026-11-24, bloco A).
// Fora de /api/ma/documents e de ma_documents de propósito: aquela rota só exige login.
// Bucket privado ma-documents (sem política de Storage; só a chave de serviço, aqui, depois do papel).
// Envio em 3 passos: "preparar" devolve link de upload de uso único; o navegador sobe direto ao bucket;
// "confirmar" confere que o objeto existe e o tamanho, e só então grava o registro.

const BUCKET = "ma-documents";
const LINK_DOWNLOAD_SEGUNDOS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = TIPOS_DOCUMENTO.map(t => t.value) as [string, ...string[]];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ deal_id: string }> };

async function carregar(dealId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) } as const;
  if (!UUID.test(dealId)) return { erro: NextResponse.json({ error: "Deal não encontrado" }, { status: 404 }) } as const;
  const db = svc();
  const { data: profile } = await db.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  const { data: deal } = await db
    .from("ma_deals")
    .select("id, assigned_to, created_by, asset_data")
    .eq("id", dealId)
    .is("deleted_at", null)
    .maybeSingle();
  const acesso = acessoCommodity(profile?.role, deal ?? {}, user.id);
  if (!acesso) return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) } as const;
  if (!deal) return { erro: NextResponse.json({ error: "Deal não encontrado" }, { status: 404 }) } as const;
  return { db, user, profile, deal, acesso } as const;
}

function commodityDe(assetData: unknown): CommodityGravada | null {
  const ad = (assetData ?? {}) as Record<string, unknown>;
  return (ad.commodity as CommodityGravada | undefined) ?? null;
}

/** Relê o asset_data e troca só commodity.documentos. */
async function gravarDocumentos(db: ReturnType<typeof svc>, dealId: string, alterar: (docs: DocumentoComercial[]) => DocumentoComercial[]) {
  const { data: atual } = await db.from("ma_deals").select("asset_data").eq("id", dealId).single();
  const ad = { ...((atual?.asset_data ?? {}) as Record<string, unknown>) };
  const c = (ad.commodity ?? null) as CommodityGravada | null;
  if (!c) return { erro: "Registre o pedido de commodity antes de enviar documentos." } as const;
  const docs = alterar([...(c.documentos ?? [])]);
  ad.commodity = { ...c, documentos: docs };
  const { error } = await db.from("ma_deals").update({ asset_data: ad, updated_at: new Date().toISOString() }).eq("id", dealId);
  if (error) return { erro: "Não foi possível gravar o documento. Tente novamente." } as const;
  return { docs } as const;
}

// GET: lista (sem link) ou, com ?id=, devolve link assinado de 10 minutos.
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { deal_id } = await ctx.params;
  const c = await carregar(deal_id);
  if ("erro" in c) return c.erro;
  const commodity = commodityDe(c.deal.asset_data);
  const ativos = documentosAtivos(commodity?.documentos);
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const doc = ativos.find(d => d.id === id);
    if (!doc || !caminhoPertenceAoDeal(deal_id, doc.caminho)) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    const { data, error } = await c.db.storage.from(BUCKET).createSignedUrl(doc.caminho, LINK_DOWNLOAD_SEGUNDOS);
    if (error || !data) return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 500 });
    await logAudit({
      userId: c.user.id, userName: c.profile?.full_name, action: "ACCESS", entity: "ma_deals", entityId: deal_id,
      newData: { documento_comercial: { id: doc.id, tipo: doc.tipo } }, ipAddress: getClientIp(req),
    });
    return NextResponse.json({ url: data.signedUrl, expira_em_segundos: LINK_DOWNLOAD_SEGUNDOS });
  }
  return NextResponse.json({
    documentos: ativos
      .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))
      .map(d => ({ id: d.id, tipo: d.tipo, nome: d.nome, enviado_por_nome: d.enviado_por_nome ?? null, enviado_em: d.enviado_em })),
    situacao_documentos: situacaoDocumentos(commodity?.documentos),
    pode_enviar: c.acesso === "gravar",
    pode_excluir: podeExcluirDocumento(c.profile?.role),
  });
}

const prepararSchema = z.object({
  acao: z.literal("preparar"),
  tipo: z.enum(TIPOS),
  nome: z.string().min(1).max(200),
  tamanho: z.number().int().positive(),
});
const confirmarSchema = z.object({
  acao: z.literal("confirmar"),
  tipo: z.enum(TIPOS),
  nome: z.string().min(1).max(200),
  caminho: z.string().min(1).max(400),
});

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { deal_id } = await ctx.params;
  const c = await carregar(deal_id);
  if ("erro" in c) return c.erro;
  if (c.acesso !== "gravar") return NextResponse.json({ error: "Sem permissão para enviar documentos" }, { status: 403 });
  if (!commodityDe(c.deal.asset_data)) {
    return NextResponse.json({ error: "Registre o pedido de commodity antes de enviar documentos." }, { status: 422 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido" }, { status: 400 }); }

  const prep = prepararSchema.safeParse(body);
  if (prep.success) {
    const invalido = validarArquivo(prep.data.nome, prep.data.tamanho);
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 });
    const caminho = caminhoDocumento(deal_id, randomUUID(), prep.data.nome);
    const { data, error } = await c.db.storage.from(BUCKET).createSignedUploadUrl(caminho);
    if (error || !data) {
      console.error("[commodity documentos preparar]", error?.message);
      return NextResponse.json({ error: "Não foi possível preparar o envio." }, { status: 500 });
    }
    return NextResponse.json({ bucket: BUCKET, caminho, token: data.token, content_type: ARQUIVO_TIPOS_MIME[extensao(prep.data.nome)] });
  }

  const conf = confirmarSchema.safeParse(body);
  if (!conf.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const { tipo, nome, caminho } = conf.data;
  if (!caminhoPertenceAoDeal(deal_id, caminho)) return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });

  // Confere que o objeto existe e o tamanho real (o link de upload não limita tamanho).
  const pasta = `${deal_id}/comercial`;
  const arquivo = caminho.slice(pasta.length + 1);
  const { data: lista } = await c.db.storage.from(BUCKET).list(pasta, { search: arquivo, limit: 5 });
  const obj = (lista ?? []).find(o => o.name === arquivo);
  if (!obj) return NextResponse.json({ error: "Arquivo não encontrado no envio. Tente de novo." }, { status: 400 });
  const tamanho = Number((obj.metadata as Record<string, unknown> | null)?.size ?? 0);
  if (tamanho > ARQUIVO_MAX_BYTES || validarArquivo(nome, tamanho || 1)) {
    await c.db.storage.from(BUCKET).remove([caminho]);
    return NextResponse.json({ error: MSG_ARQUIVO_INVALIDO }, { status: 400 });
  }

  const doc: DocumentoComercial = {
    id: randomUUID(),
    tipo: tipo as DocumentoComercial["tipo"],
    nome: nome.slice(0, 200),
    caminho,
    enviado_por: c.user.id,
    enviado_por_nome: c.profile?.full_name ?? null,
    enviado_em: new Date().toISOString(),
  };
  const r = await gravarDocumentos(c.db, deal_id, docs => {
    if (docs.some(d => d.caminho === caminho)) return docs; // confirmação repetida não duplica
    return [...docs, doc];
  });
  if ("erro" in r) return NextResponse.json({ error: r.erro }, { status: 500 });

  await logAudit({
    userId: c.user.id, userName: c.profile?.full_name, action: "CREATE", entity: "ma_deals", entityId: deal_id,
    newData: { documento_comercial: { id: doc.id, tipo: doc.tipo, nome: doc.nome } }, ipAddress: getClientIp(req),
  });
  return NextResponse.json({ ok: true, situacao_documentos: situacaoDocumentos(r.docs) });
}

const excluirSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(5, "Motivo com pelo menos 5 caracteres").max(500, "Motivo com até 500 caracteres"),
});

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { deal_id } = await ctx.params;
  const c = await carregar(deal_id);
  if ("erro" in c) return c.erro;
  if (!podeExcluirDocumento(c.profile?.role)) return NextResponse.json({ error: "Somente ADMIN ou GESTAO excluem documento comercial" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido" }, { status: 400 }); }
  const p = excluirSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: Object.values(p.error.flatten().fieldErrors).flat()[0] ?? "Pedido inválido" }, { status: 400 });

  const doc = documentosAtivos(commodityDe(c.deal.asset_data)?.documentos).find(d => d.id === p.data.id);
  if (!doc || !caminhoPertenceAoDeal(deal_id, doc.caminho)) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  const { error: rmErr } = await c.db.storage.from(BUCKET).remove([doc.caminho]);
  if (rmErr) return NextResponse.json({ error: "Não foi possível excluir o arquivo." }, { status: 500 });

  const agora = new Date().toISOString();
  const r = await gravarDocumentos(c.db, deal_id, docs => docs.map(d =>
    d.id === doc.id ? { ...d, excluido_em: agora, excluido_por: c.user.id, excluido_motivo: p.data.motivo } : d,
  ));
  if ("erro" in r) return NextResponse.json({ error: r.erro }, { status: 500 });

  await logAudit({
    userId: c.user.id, userName: c.profile?.full_name, action: "DELETE", entity: "ma_deals", entityId: deal_id,
    oldData: { documento_comercial: { id: doc.id, tipo: doc.tipo, nome: doc.nome } },
    newData: { motivo: p.data.motivo }, ipAddress: getClientIp(req),
  });
  return NextResponse.json({ ok: true, situacao_documentos: situacaoDocumentos(r.docs) });
}

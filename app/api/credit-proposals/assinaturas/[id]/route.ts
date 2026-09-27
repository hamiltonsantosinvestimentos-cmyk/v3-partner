import { NextRequest, NextResponse } from "next/server";
import {
  acessoProposta, APP_URL, COLUNAS, extensaoValida, MAX_BYTES, notificarAssinatura, salvarArquivo, urlArquivo, svcAssinatura, type DocAssinatura,
} from "@/lib/documentos-assinatura";
import { aplicarMarca, marcaDoPerfil } from "@/lib/enterprise";

export const maxDuration = 60;

// GET  ?arquivo=original|assinado — baixar o arquivo (redireciona para URL temporária)
// POST JSON { acao: "enviar", email } — e-mail ao cliente com orientação + link para baixar/subir
// POST JSON { acao: "confirmar" }     — confirma o envio do assinado → notifica a Mesa Operacional
// POST JSON { acao: "cancelar" }      — Mesa descarta o documento
// POST multipart { file }             — partner/Mesa sobe o arquivo assinado pela plataforma

interface Params { params: Promise<{ id: string }> }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function carregar(id: string) {
  const db = svcAssinatura();
  const { data } = await db.from("credit_documentos_assinatura").select(COLUNAS).eq("id", id).maybeSingle();
  if (!data) return { ok: false as const, res: NextResponse.json({ error: "Documento não encontrado" }, { status: 404 }) };
  const doc = data as DocAssinatura;
  const a = await acessoProposta(doc.proposal_id);
  if (!a.ok) return { ok: false as const, res: NextResponse.json({ error: a.error }, { status: a.status }) };
  return { ok: true as const, doc, a };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await carregar(id);
  if (!c.ok) return c.res;
  const qual = new URL(req.url).searchParams.get("arquivo") === "assinado" ? "assinado" : "original";
  const path = qual === "assinado" ? c.doc.assinado_path : c.doc.original_path;
  const nome = qual === "assinado" ? c.doc.assinado_nome : c.doc.original_nome;
  if (!path) return NextResponse.json({ error: "Arquivo ainda não enviado." }, { status: 404 });
  const url = await urlArquivo(c.a.db, path, nome ?? undefined);
  if (!url) return NextResponse.json({ error: "Não foi possível gerar o link do arquivo." }, { status: 500 });
  return NextResponse.redirect(url);
}

function htmlEmail(opts: { cliente: string; titulo: string; orientacao: string | null; link: string; quem: string; codigo: string | null; expira: string }) {
  const orient = opts.orientacao
    ? `<div style="margin:18px 0;padding:14px 16px;background:#13223A;border-left:3px solid #C9A84C;border-radius:8px;color:#F0ECE4;font-size:13px;line-height:1.7;white-space:pre-line;">${esc(opts.orientacao)}</div>`
    : "";
  return [
    `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#09081A;font-family:'DM Sans',Arial,sans-serif;">`,
    `<div style="max-width:560px;margin:40px auto;background:#162744;border-radius:12px;border:1px solid #243A66;overflow:hidden;">`,
    `<div style="padding:24px 32px;background:#09081A;border-bottom:1px solid #243A66;"><img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:32px;display:block;"></div>`,
    `<div style="padding:32px;color:#9BAFC5;font-size:14px;line-height:1.7;">`,
    `<h2 style="margin:0 0 14px;color:#F0ECE4;font-size:19px;">Olá, ${esc(opts.cliente)}!</h2>`,
    `<p>${esc(opts.quem)} enviou um documento para você assinar${opts.codigo ? ` (proposta ${esc(opts.codigo)})` : ""}: <strong style="color:#E8C97A;">${esc(opts.titulo)}</strong>.</p>`,
    orient,
    `<p style="margin:18px 0 6px;color:#F0ECE4;font-weight:700;">Como fazer:</p>`,
    `<ol style="margin:0 0 18px 18px;padding:0;">`,
    `<li>Clique no botão abaixo e <strong>baixe o documento</strong>.</li>`,
    `<li><strong>Assine</strong> (assinatura digital, como gov.br, ou impresso, assinado e digitalizado/fotografado com boa qualidade).</li>`,
    `<li>Volte à mesma página e <strong>envie o arquivo assinado</strong> (PDF, JPG ou PNG).</li>`,
    `</ol>`,
    `<p><a href="${opts.link}" style="display:inline-block;background:#C9A84C;color:#09081A;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:700;">Baixar e enviar o documento →</a></p>`,
    `<p style="font-size:12px;margin-top:18px;">O link vale até ${esc(opts.expira)}. Se tiver dúvida, fale com ${esc(opts.quem)}.</p>`,
    `</div></div></body></html>`,
  ].join("");
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await carregar(id);
  if (!c.ok) return c.res;
  const { doc, a } = c;
  if (doc.status === "cancelado") return NextResponse.json({ error: "Documento cancelado." }, { status: 409 });

  // ── Arquivo assinado subido pela plataforma ──
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Selecione o arquivo assinado." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo maior que 20MB." }, { status: 413 });
    const ext = extensaoValida(file);
    if (!ext) return NextResponse.json({ error: "Envie PDF, Word ou imagem (JPG/PNG)." }, { status: 415 });
    const path = `assinaturas/${doc.proposal_id}/${doc.id}/assinado-${Date.now()}.${ext}`;
    const erroUp = await salvarArquivo(a.db, path, file);
    if (erroUp) return NextResponse.json({ error: `Falha ao salvar: ${erroUp}` }, { status: 500 });
    const { data, error } = await a.db
      .from("credit_documentos_assinatura")
      .update({ assinado_path: path, assinado_nome: file.name, assinado_origem: "plataforma", assinado_por: a.userId, assinado_em: new Date().toISOString(), status: "assinado_recebido", confirmado_em: null, confirmado_por: null })
      .eq("id", doc.id)
      .select(COLUNAS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, documento: data });
  }

  const body = (await req.json().catch(() => ({}))) as { acao?: string; email?: string };

  if (body.acao === "enviar") {
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "E-mail do cliente inválido." }, { status: 400 });
    // Renova o prazo do link a cada envio (30 dias).
    const expira = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const link = `${APP_URL}/assinatura/${doc.token}`;
    const marca = a.proposal.partner_id ? await marcaDoPerfil(a.db, a.proposal.partner_id as string) : null;
    const quem = a.nome ?? marca?.nome ?? "V3 Partners";
    const { enviarEmailHtml } = await import("@/lib/email");
    await enviarEmailHtml(
      email,
      `Documento para assinatura: ${doc.titulo}`,
      aplicarMarca(
        htmlEmail({ cliente: (a.proposal.client_name as string | null) ?? "cliente", titulo: doc.titulo, orientacao: doc.orientacao, link, quem, codigo: (a.proposal.code as string | null) ?? null, expira: expira.toLocaleDateString("pt-BR") }),
        marca,
      ),
    );
    const { data, error } = await a.db
      .from("credit_documentos_assinatura")
      .update({
        email_cliente: email, email_enviado_em: new Date().toISOString(), email_enviado_por: a.userId, token_expira_em: expira.toISOString(),
        status: doc.assinado_path ? doc.status : "enviado_cliente",
      })
      .eq("id", doc.id)
      .select(COLUNAS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, documento: data, link });
  }

  if (body.acao === "confirmar") {
    if (!doc.assinado_path) return NextResponse.json({ error: "Ainda não há arquivo assinado para confirmar." }, { status: 422 });
    const { data, error } = await a.db
      .from("credit_documentos_assinatura")
      .update({ status: "confirmado", confirmado_em: new Date().toISOString(), confirmado_por: a.userId })
      .eq("id", doc.id)
      .select(COLUNAS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await notificarAssinatura({
      proposal: { id: a.proposal.id as string, code: a.proposal.code as string | null, client_name: a.proposal.client_name as string | null, partner_id: a.proposal.partner_id as string | null },
      titulo: doc.titulo,
      evento: "confirmado",
      quem: a.nome,
    });
    return NextResponse.json({ ok: true, documento: data });
  }

  if (body.acao === "cancelar") {
    if (!a.mesa) return NextResponse.json({ error: "Só a Mesa Operacional cancela o documento." }, { status: 403 });
    await a.db.from("credit_documentos_assinatura").update({ status: "cancelado" }).eq("id", doc.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

// GET  /api/credit-proposals/{id}/encaminhar — dados da seção "Encaminhar para Instituição".
// POST /api/credit-proposals/{id}/encaminhar — { acao: "enviar", ... } ou { acao: "reenviar", destinatario_id, email }.
// Só ADMIN, GESTAO e MESA_OPERACIONAL (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";
import { carregarProposta, dadosDaTela, documentosDaProposta, executarEnvio, PAPEIS_MESA, reenviar, type PedidoEnvio } from "@/lib/encaminhar-instituicao-servidor";
import { dividirEmPartes, montarAssunto, montarCorpo } from "@/lib/encaminhar-instituicao";
import { enviarEmailRegistrado } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const dados = await dadosDaTela(svcDb(), id);
  if (!dados) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  return NextResponse.json(dados);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const body = await req.json().catch(() => null) as (PedidoEnvio & { acao?: string; destinatario_id?: string; email?: string }) | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const deps = { db: svcDb(), mailer: enviarEmailRegistrado };
  const remetente = { id: c.id, nome: c.nome, email: c.email };

  if (body.acao === "previa") {
    const db = svcDb();
    const p = await carregarProposta(db, id);
    if (!p) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
    const docs = (await documentosDaProposta(db, p)).filter((d) => (body.documentos ?? []).includes(d.storage_path));
    const { partes } = dividirEmPartes(docs);
    const total = Math.max(1, partes.length);
    return NextResponse.json({
      assunto: montarAssunto(p, 1, total),
      html: montarCorpo({ proposta: p, documentos: partes[0] ?? [], mensagem: body.mensagem, parte: 1, total, remetenteNome: c.nome }),
      partes: total,
    });
  }

  if (body.acao === "reenviar") {
    if (!body.destinatario_id || !body.email) return NextResponse.json({ error: "Informe o destinatário e o e-mail." }, { status: 400 });
    const r = await reenviar(deps, id, body.destinatario_id, body.email, remetente);
    await logAudit({ userId: c.id, userName: c.nome, action: "UPDATE", entity: "credit_desk_proposals", entityId: id, ipAddress: c.ip,
      newData: { evento: "encaminhamento_reenviado", destinatario_id: body.destinatario_id, email: body.email.trim().toLowerCase(), ok: r.ok } });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }

  const r = await executarEnvio(deps, id, { instituicoes: body.instituicoes, documentos: Array.isArray(body.documentos) ? body.documentos : [], mensagem: body.mensagem }, remetente);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAudit({ userId: c.id, userName: c.nome, action: "UPDATE", entity: "credit_desk_proposals", entityId: id, ipAddress: c.ip,
    newData: { evento: "proposta_encaminhada", partes: r.partes, documentos: body.documentos.length,
      instituicoes: r.resultados.map((x) => ({ nome: x.nome, status: x.status, enviados: x.enviados, falhas: x.falhas.length })) } });
  return NextResponse.json(r);
}

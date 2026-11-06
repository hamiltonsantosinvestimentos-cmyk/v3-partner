// GET /api/envios-instituicoes — tela "E-mails enviados" (Mesa Operacional).
// Filtros: de, ate (AAAA-MM-DD, Brasília), instituicao_id, situacao, enviado_por, busca, pagina.
// Só ADMIN, GESTAO e MESA_OPERACIONAL.
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";
import { PAPEIS_MESA } from "@/lib/encaminhar-instituicao-servidor";
import { situacaoGeral, type Situacao } from "@/lib/encaminhar-instituicao";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;
const dia = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export async function GET(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const ate = dia(sp.get("ate")) ?? hoje;
  const de = dia(sp.get("de")) ?? new Date(Date.parse(`${ate}T12:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const inicio = new Date(`${de}T03:00:00.000Z`).toISOString();
  const fim = new Date(Date.parse(`${ate}T03:00:00.000Z`) + 86_400_000).toISOString();

  const db = svcDb();
  let q = db.from("credit_proposal_envios")
    .select("id, proposal_id, instituicao_id, instituicao_nome, destinatarios, assunto, mensagem, documentos, partes, status, erro, enviado_por, enviado_por_nome, enviado_em, credit_desk_proposals(code, client_name), credit_proposal_envio_destinatarios(id, email, nome, fora_do_cadastro, parte, status, motivo, enviado_em, entregue_em, aberto_em, devolvido_em, substituido_por, atualizado_em)")
    .gte("enviado_em", inicio).lt("enviado_em", fim)
    .order("enviado_em", { ascending: false });
  const inst = sp.get("instituicao_id");
  if (inst) q = q.eq("instituicao_id", inst);
  const por = sp.get("enviado_por");
  if (por) q = q.eq("enviado_por", por);
  const { data, error } = await q.limit(2000);
  if (error) return NextResponse.json({ error: "Não foi possível carregar os envios." }, { status: 500 });

  type Dest = { email: string; status: Situacao; substituido_por: string | null };
  const busca = (sp.get("busca") ?? "").trim().toLowerCase();
  const situacao = sp.get("situacao") as Situacao | null;
  const linhas = ((data ?? []) as Record<string, unknown>[]).map((e) => {
    const dest = ((e.credit_proposal_envio_destinatarios ?? []) as Dest[]);
    const atuais = dest.filter((d) => !d.substituido_por);
    const prop = e.credit_desk_proposals as { code?: string; client_name?: string } | null;
    return { ...e, credit_proposal_envio_destinatarios: dest, proposta_code: prop?.code ?? "", cliente: prop?.client_name ?? "", situacao_geral: situacaoGeral(atuais.map((d) => d.status)), credit_desk_proposals: undefined };
  }).filter((e) => {
    if (situacao && e.situacao_geral !== situacao) return false;
    if (!busca) return true;
    const dests = e.credit_proposal_envio_destinatarios.map((d) => d.email).join(" ");
    return `${e.proposta_code} ${e.cliente} ${dests}`.toLowerCase().includes(busca);
  });

  // Resumo do período (todos os destinatários atuais, não só a página).
  const contagem = { envios: linhas.length, entregues: 0, abertos: 0, devolvidos: 0, falhas: 0 };
  for (const e of linhas) {
    for (const d of e.credit_proposal_envio_destinatarios.filter((x) => !x.substituido_por)) {
      if (d.status === "entregue") contagem.entregues++;
      if (d.status === "aberto") { contagem.abertos++; contagem.entregues++; }
      if (d.status === "devolvido" || d.status === "spam") contagem.devolvidos++;
      if (d.status === "falha") contagem.falhas++;
    }
  }

  const pagina = Math.max(1, Number(sp.get("pagina") ?? 1) || 1);
  const { data: insts } = await db.from("instituicoes").select("id, nome").order("nome");
  const remetentes = new Map<string, string>();
  for (const e of (data ?? []) as { enviado_por: string | null; enviado_por_nome: string | null }[]) if (e.enviado_por) remetentes.set(e.enviado_por, e.enviado_por_nome ?? "-");
  return NextResponse.json({
    periodo: { de, ate },
    resumo: contagem,
    envios: linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    total: linhas.length,
    pagina,
    por_pagina: POR_PAGINA,
    instituicoes: ((insts ?? []) as { id: string; nome: string }[]).map((i) => ({ id: i.id, nome: i.nome.trim() })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    remetentes: [...remetentes.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  });
}

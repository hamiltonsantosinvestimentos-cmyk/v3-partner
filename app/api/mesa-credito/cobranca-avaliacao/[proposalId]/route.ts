import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { launchBrowser } from "@/lib/credit-report-generate";
import { atualizarMetadata } from "@/lib/credit-proposal-meta";
import {
  DESCRICAO_PADRAO, cobrancasAvaliacao, codigoCobrancaAvaliacao, htmlCobrancaAvaliacao, type CobrancaAvaliacao,
} from "@/lib/cobranca-avaliacao";

export const maxDuration = 120;

// Cobrança da avaliação de engenharia (19/10/2026).
//   GET                 → { cobrancas }
//   GET ?id=<id>        → PDF da cobrança (para enviar ao cliente)
//   POST { valor, vencimento, descricao?, imovel? } → cria a cobrança
//   PATCH { id, pago }  → marca/desmarca como paga
//   DELETE ?id=<id>     → remove
// Lista em credit_desk_proposals.metadata.cobrancas_avaliacao.

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Ctx = { params: Promise<{ proposalId: string }> };

async function contexto(proposalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ROLES.includes(profile.role as string)) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 403 }) };
  const { data: proposta } = await db
    .from("credit_desk_proposals")
    .select("id, code, client_name, client_cpf_cnpj, metadata")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposta) return { erro: NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 }) };
  return { db, nome: (profile.full_name as string | null) ?? null, proposta };
}

function salvar(db: ReturnType<typeof svc>, proposalId: string, alterar: (atual: CobrancaAvaliacao[]) => CobrancaAvaliacao[]) {
  return atualizarMetadata(db, proposalId, (meta) => ({ ...meta, cobrancas_avaliacao: alterar(cobrancasAvaliacao(meta)) }));
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { proposalId } = await params;
  const ctx = await contexto(proposalId);
  if ("erro" in ctx) return ctx.erro;
  const { proposta } = ctx;
  const lista = cobrancasAvaliacao(proposta.metadata as Record<string, unknown>);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ cobrancas: lista });

  const c = lista.find((x) => x.id === id);
  if (!c) return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
  const html = htmlCobrancaAvaliacao({
    cobranca: c, clienteNome: proposta.client_name ?? "Cliente", clienteDoc: proposta.client_cpf_cnpj, propostaCode: proposta.code, emitidoEm: new Date(c.criado_em),
  });
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))])).catch(() => {});
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    const cliente = (proposta.client_name ?? "cliente").split(/\s+/).slice(0, 3).join("-");
    const arquivo = `Cobranca-Avaliacao-${c.codigo}-${cliente}`.normalize("NFD").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-");
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${arquivo}.pdf"` } });
  } catch (e) {
    return NextResponse.json({ error: `Falha ao gerar PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { proposalId } = await params;
  const ctx = await contexto(proposalId);
  if ("erro" in ctx) return ctx.erro;
  const body = (await req.json().catch(() => ({}))) as { valor?: number; vencimento?: string; descricao?: string; imovel?: string };
  const valor = Math.round(Number(body.valor) * 100) / 100;
  if (!(valor > 0)) return NextResponse.json({ error: "Informe o valor da avaliação." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.vencimento ?? "")) return NextResponse.json({ error: "Informe o vencimento." }, { status: 400 });
  let nova: CobrancaAvaliacao | null = null;
  const r = await salvar(ctx.db, proposalId, (lista) => {
    nova = {
      id: randomUUID(),
      codigo: codigoCobrancaAvaliacao(ctx.proposta.code, lista),
      valor,
      vencimento: body.vencimento!,
      descricao: (body.descricao ?? "").trim() || DESCRICAO_PADRAO,
      imovel: (body.imovel ?? "").trim() || null,
      criado_em: new Date().toISOString(),
      criado_por: ctx.nome,
    };
    return [...lista, nova];
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ cobranca: nova, cobrancas: cobrancasAvaliacao(r.metadata) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { proposalId } = await params;
  const ctx = await contexto(proposalId);
  if ("erro" in ctx) return ctx.erro;
  const body = (await req.json().catch(() => ({}))) as { id?: string; pago?: boolean };
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const r = await salvar(ctx.db, proposalId, (lista) => lista.map((c) => (c.id === body.id
    ? { ...c, pago_em: body.pago ? new Date().toISOString() : null, pago_por: body.pago ? ctx.nome : null }
    : c)));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ cobrancas: cobrancasAvaliacao(r.metadata) });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { proposalId } = await params;
  const ctx = await contexto(proposalId);
  if ("erro" in ctx) return ctx.erro;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const r = await salvar(ctx.db, proposalId, (lista) => lista.filter((c) => c.id !== id));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ cobrancas: cobrancasAvaliacao(r.metadata) });
}

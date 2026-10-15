import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { launchBrowser } from "@/lib/credit-report-generate";
import {
  calcularCobranca, codigoCobranca, htmlCobranca, mandatoAssinadoDaProposta, recursosLiberados,
  type RecursoLiberado,
} from "@/lib/cobranca-mandato";

export const maxDuration = 120;

// Recursos liberados + cobrança da Remuneração de Sucesso (15/10/2026).
//   GET                    → { mandato, recursos } (mandato = Mandato de Crédito assinado ou null)
//   GET ?liberacao=<id>    → PDF de cobrança daquela liberação
//   POST { valor, data, instituicao?, obs? } → lança uma liberação
//   DELETE ?liberacao=<id> → remove uma liberação
// Lista em credit_desk_proposals.metadata.recursos_liberados.

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type Ctx = { params: Promise<{ proposalId: string }> };

async function contexto(proposalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ROLES.includes(profile.role as string)) {
    return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 403 }) };
  }
  const { data: proposta } = await db
    .from("credit_desk_proposals")
    .select("id, code, client_name, client_cpf_cnpj, comissao_mandato_perc, metadata")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposta) return { erro: NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 }) };
  return { db, user, profile, proposta };
}

async function salvarRecursos(
  db: ReturnType<typeof svc>,
  proposalId: string,
  alterar: (atual: RecursoLiberado[]) => RecursoLiberado[],
) {
  // Relê o metadata na hora de gravar para não sobrescrever o que mudou no meio.
  const { data } = await db.from("credit_desk_proposals").select("metadata").eq("id", proposalId).single();
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const recursos = alterar(recursosLiberados(metadata));
  const { error } = await db
    .from("credit_desk_proposals")
    .update({ metadata: { ...metadata, recursos_liberados: recursos } })
    .eq("id", proposalId);
  return { recursos, error };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { proposalId } = await params;
  const ctx = await contexto(proposalId);
  if ("erro" in ctx) return ctx.erro;
  const { db, proposta } = ctx;
  const metadata = (proposta.metadata ?? {}) as Record<string, unknown>;
  const recursos = recursosLiberados(metadata);
  const mandato = await mandatoAssinadoDaProposta(db, proposalId, proposta);

  const liberacaoId = new URL(req.url).searchParams.get("liberacao");
  if (!liberacaoId) {
    return NextResponse.json({
      mandato: mandato && {
        contract_code: mandato.contract_code,
        signed_at: mandato.signed_at,
        percentual: mandato.percentual,
        contratante_nome: mandato.contratante_nome,
      },
      recursos: recursos.map((r) => ({ ...r, ...(mandato ? calcularCobranca(mandato, r) : {}) })),
    });
  }

  const recurso = recursos.find((r) => r.id === liberacaoId);
  if (!recurso) return NextResponse.json({ error: "Liberação não encontrada" }, { status: 404 });
  if (!mandato) {
    return NextResponse.json({ error: "A proposta não tem Mandato de Crédito assinado." }, { status: 422 });
  }
  if (!(mandato.percentual > 0)) {
    return NextResponse.json({ error: "Não foi possível ler o % do mandato assinado." }, { status: 422 });
  }

  const codigo = codigoCobranca(mandato, recursos, recurso);
  const html = htmlCobranca({ mandato, recurso, codigo, propostaCode: proposta.code, emitidoEm: new Date() });

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))])).catch(() => {});
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });

    if (!recurso.cobranca_gerada_em) {
      await salvarRecursos(db, proposalId, (lista) =>
        lista.map((r) => (r.id === recurso.id ? { ...r, cobranca_gerada_em: new Date().toISOString() } : r)));
    }

    const cliente = mandato.contratante_nome.split(/\s+/).slice(0, 3).join("-");
    const arquivo = `Cobranca-${codigo}-${cliente}`
      .normalize("NFD").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${arquivo}.pdf"`,
      },
    });
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
  const { db, user, profile } = ctx;

  const body = (await req.json().catch(() => ({}))) as { valor?: unknown; data?: unknown; instituicao?: unknown; obs?: unknown };
  const valor = Math.round(Number(body.valor) * 100) / 100;
  const data = typeof body.data === "string" ? body.data.slice(0, 10) : "";
  if (!(valor > 0)) return NextResponse.json({ error: "Informe o valor liberado." }, { status: 422 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) {
    return NextResponse.json({ error: "Informe a data da liberação." }, { status: 422 });
  }
  const texto = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 300) : "");

  const novo: RecursoLiberado = {
    id: randomUUID(),
    valor,
    data,
    ...(texto(body.instituicao) ? { instituicao: texto(body.instituicao) } : {}),
    ...(texto(body.obs) ? { obs: texto(body.obs) } : {}),
    criado_em: new Date().toISOString(),
    criado_por: (profile.full_name as string | null) ?? user.id,
  };
  const { recursos, error } = await salvarRecursos(db, proposalId, (lista) => [...lista, novo]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recursos });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { proposalId } = await params;
  const ctx = await contexto(proposalId);
  if ("erro" in ctx) return ctx.erro;
  const liberacaoId = new URL(req.url).searchParams.get("liberacao");
  if (!liberacaoId) return NextResponse.json({ error: "Informe a liberação." }, { status: 422 });
  const { recursos, error } = await salvarRecursos(ctx.db, proposalId, (lista) => lista.filter((r) => r.id !== liberacaoId));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recursos });
}

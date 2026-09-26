import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise } from "@/lib/enterprise-server";
import {
  adicionarDominio, instrucoesDns, normalizarDominio, removerDominio, statusDominio, vercelConfigurada,
} from "@/lib/vercel-dominios";

// Domínio próprio do Enterprise (white label). Só o master.
// GET    — domínio atual + status (consulta a Vercel na hora) + instrução de DNS
// POST   { dominio } — grava e cadastra no projeto da Vercel
// DELETE — remove o domínio (volta a usar só app.v3partners.com.br)

async function montarStatus(db: Extract<Awaited<ReturnType<typeof exigirEnterprise>>, { ok: true }>) {
  const { data } = await db.db
    .from("profiles")
    .select("white_label_dominio, white_label_dominio_status, white_label_dominio_atualizado_em")
    .eq("id", db.userId)
    .single();
  const dominio = (data?.white_label_dominio as string | null) ?? null;
  if (!dominio) return { dominio: null, vercelConfigurada: vercelConfigurada() };

  let status = (data?.white_label_dominio_status as string | null) ?? "pendente";
  let detalhe: Awaited<ReturnType<typeof statusDominio>> | null = null;
  if (vercelConfigurada()) {
    detalhe = await statusDominio(dominio).catch(() => null);
    if (detalhe) {
      const novo = detalhe.noProjeto && detalhe.verificado && detalhe.dnsOk ? "ativo" : detalhe.noProjeto ? "pendente" : "erro";
      if (novo !== status) {
        status = novo;
        await db.db.from("profiles").update({ white_label_dominio_status: novo, white_label_dominio_atualizado_em: new Date().toISOString() }).eq("id", db.userId);
      }
    }
  }
  return {
    dominio,
    status,
    dns: instrucoesDns(dominio),
    verificacao: detalhe?.verificacao ?? [],
    dnsOk: detalhe?.dnsOk ?? null,
    vercelConfigurada: vercelConfigurada(),
    atualizadoEm: data?.white_label_dominio_atualizado_em ?? null,
  };
}

export async function GET() {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  return NextResponse.json(await montarStatus(auth));
}

export async function POST(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { dominio?: string };
  const dominio = normalizarDominio(body.dominio ?? "");
  if (!dominio) return NextResponse.json({ error: "Domínio inválido. Ex.: plataforma.suaempresa.com.br" }, { status: 400 });

  const { data: emUso } = await auth.db.from("profiles").select("id").ilike("white_label_dominio", dominio).neq("id", auth.userId).maybeSingle();
  if (emUso) return NextResponse.json({ error: "Este domínio já está em uso por outro Enterprise." }, { status: 409 });

  // Troca de domínio: tira o anterior do projeto.
  const { data: atual } = await auth.db.from("profiles").select("white_label_dominio").eq("id", auth.userId).single();
  const anterior = (atual?.white_label_dominio as string | null) ?? null;

  if (vercelConfigurada()) {
    const r = await adicionarDominio(dominio);
    if (!r.ok) return NextResponse.json({ error: `A Vercel recusou o domínio: ${r.error}` }, { status: 502 });
    if (anterior && anterior !== dominio) await removerDominio(anterior).catch(() => {});
  }

  const { error } = await auth.db
    .from("profiles")
    .update({ white_label_dominio: dominio, white_label_dominio_status: "pendente", white_label_dominio_atualizado_em: new Date().toISOString() })
    .eq("id", auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await montarStatus(auth));
}

export async function DELETE() {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  const { data: atual } = await auth.db.from("profiles").select("white_label_dominio").eq("id", auth.userId).single();
  const dominio = (atual?.white_label_dominio as string | null) ?? null;
  if (dominio && vercelConfigurada()) await removerDominio(dominio).catch(() => {});
  await auth.db
    .from("profiles")
    .update({ white_label_dominio: null, white_label_dominio_status: null, white_label_dominio_atualizado_em: new Date().toISOString() })
    .eq("id", auth.userId);
  return NextResponse.json({ ok: true, dominio: null, vercelConfigurada: vercelConfigurada() });
}

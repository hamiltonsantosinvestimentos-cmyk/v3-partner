import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise, logAntesDaEscritaAdmin, logFalhaAdmin, type AuthEnterprise } from "@/lib/enterprise-server";
import {
  adicionarDominio, instrucoesDns, normalizarDominio, removerDominio, statusDominio, vercelConfigurada,
} from "@/lib/vercel-dominios";

// Domínio próprio do Enterprise (white label). Só o master, ou o ADMIN em nome dele (?master=<id>,
// BRIEF 2026-11-19_admin-configura-white-label-enterprise.md, com log obrigatório antes da escrita).
// GET    — domínio atual + status (consulta a Vercel na hora) + instrução de DNS. A sincronização do
//          status com a Vercel é automática e fica fora do log (não é alteração feita pelo ADMIN).
// POST   { dominio } — grava e cadastra no projeto da Vercel
// DELETE — remove o domínio (volta a usar só app.v3partners.com.br)

async function montarStatus(auth: AuthEnterprise) {
  const { data } = await auth.db
    .from("profiles")
    .select("white_label_dominio, white_label_dominio_status, white_label_dominio_atualizado_em")
    .eq("id", auth.userId)
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
        await auth.db.from("profiles").update({ white_label_dominio_status: novo, white_label_dominio_atualizado_em: new Date().toISOString() }).eq("id", auth.userId);
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

export async function GET(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true, req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  return NextResponse.json(await montarStatus(auth));
}

export async function POST(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true, req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { dominio?: string };
  const dominio = normalizarDominio(body.dominio ?? "");
  if (!dominio) return NextResponse.json({ error: "Domínio inválido. Ex.: plataforma.suaempresa.com.br" }, { status: 400 });

  const { data: emUso } = await auth.db.from("profiles").select("id").ilike("white_label_dominio", dominio).neq("id", auth.userId).maybeSingle();
  if (emUso) return NextResponse.json({ error: "Este domínio já está em uso por outro Enterprise." }, { status: 409 });

  // Troca de domínio: tira o anterior do projeto.
  const { data: atual } = await auth.db.from("profiles").select("white_label_dominio").eq("id", auth.userId).single();
  const anterior = (atual?.white_label_dominio as string | null) ?? null;

  const dadosLog = { action: "UPDATE" as const, oldData: { white_label_dominio: anterior }, newData: { white_label_dominio: dominio, anterior } };
  const bloqueio = await logAntesDaEscritaAdmin(auth, req, dadosLog);
  if (bloqueio) return bloqueio;

  if (vercelConfigurada()) {
    const r = await adicionarDominio(dominio);
    if (!r.ok) {
      await logFalhaAdmin(auth, req, dadosLog, r.error ?? "Vercel recusou");
      return NextResponse.json({ error: `A Vercel recusou o domínio: ${r.error}` }, { status: 502 });
    }
    if (anterior && anterior !== dominio) await removerDominio(anterior).catch(() => {});
  }

  const { error } = await auth.db
    .from("profiles")
    .update({ white_label_dominio: dominio, white_label_dominio_status: "pendente", white_label_dominio_atualizado_em: new Date().toISOString() })
    .eq("id", auth.userId);
  if (error) {
    await logFalhaAdmin(auth, req, dadosLog, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(await montarStatus(auth));
}

export async function DELETE(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true, req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  const { data: atual } = await auth.db.from("profiles").select("white_label_dominio").eq("id", auth.userId).single();
  const dominio = (atual?.white_label_dominio as string | null) ?? null;

  const dadosLog = { action: "DELETE" as const, oldData: { white_label_dominio: dominio }, newData: { white_label_dominio: null, anterior: dominio } };
  const bloqueio = await logAntesDaEscritaAdmin(auth, req, dadosLog);
  if (bloqueio) return bloqueio;

  if (dominio && vercelConfigurada()) await removerDominio(dominio).catch(() => {});
  const { error } = await auth.db
    .from("profiles")
    .update({ white_label_dominio: null, white_label_dominio_status: null, white_label_dominio_atualizado_em: new Date().toISOString() })
    .eq("id", auth.userId);
  if (error) {
    await logFalhaAdmin(auth, req, dadosLog, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, dominio: null, vercelConfigurada: vercelConfigurada() });
}

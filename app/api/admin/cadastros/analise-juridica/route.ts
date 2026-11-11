import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { consultarJuridicoCheckTudo } from "@/lib/credit-checktudo-juridico";
import { apenasTotais, documentosDoEscopo, TRAVA_RECONSULTA_MS, type CadastroJuridico } from "@/lib/analise-juridica-cadastro";

// Análise jurídica do cadastro de partner (BRIEF docs/briefs/2026-11-10_analise-juridica-cadastro-partner.md).
// Só ADMIN, padrão de app/api/admin/cadastros/documento: anônimo 401, outros papéis 404 genérico.
// A tabela partner_registration_juridico tem RLS sem política: só a service role desta rota lê e grava.
// Grava só os 5 totais e o documento mascarado; o dossiê bruto do CheckTudo não é gravado nem devolvido.

export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  const db = svc();
  const { data: perfil } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if ((perfil as { role?: string } | null)?.role !== "ADMIN") {
    return { erro: NextResponse.json({ error: "Não encontrado" }, { status: 404, headers: NO_STORE }) };
  }
  return { user, db, nome: (perfil as { full_name?: string } | null)?.full_name ?? null };
}

const COLUNAS = "id, doc_tipo, doc_mascarado, escopo, ok, resultado, erro, consultado_por_nome, consultado_em";

// GET ?registration_id= : histórico, mais recente primeiro.
export async function GET(req: NextRequest) {
  const a = await admin();
  if ("erro" in a) return a.erro;
  const id = new URL(req.url).searchParams.get("registration_id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Não encontrado" }, { status: 404, headers: NO_STORE });
  const { data, error } = await a.db
    .from("partner_registration_juridico")
    .select(COLUNAS)
    .eq("registration_id", id)
    .order("consultado_em", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "Não foi possível carregar o histórico" }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ consultas: data ?? [] }, { headers: NO_STORE });
}

// POST { registration_id, escopo: "PJ_PF" | "PF" } : consulta no CheckTudo e grava uma linha por documento.
export async function POST(req: NextRequest) {
  const a = await admin();
  if ("erro" in a) return a.erro;
  const body = await req.json().catch(() => ({})) as { registration_id?: string; escopo?: string };
  const id = String(body.registration_id ?? "");
  const pedido = body.escopo === "PF" ? "PF" : body.escopo === "PJ_PF" ? "PJ_PF" : null;
  if (!UUID_RE.test(id) || !pedido) return NextResponse.json({ error: "Pedido inválido" }, { status: 422, headers: NO_STORE });

  const { data: cad } = await a.db
    .from("partner_registrations")
    .select("id, tipo_pessoa, cpf, cnpj, nome_completo, razao_social")
    .eq("id", id)
    .maybeSingle();
  if (!cad) return NextResponse.json({ error: "Não encontrado" }, { status: 404, headers: NO_STORE });

  const plano = documentosDoEscopo(cad as CadastroJuridico, pedido);
  if (!plano.ok) return NextResponse.json({ error: plano.erro }, { status: 422, headers: NO_STORE });
  const mascarados = plano.documentos.map((d) => d.exibicao);

  // Trava de 5 minutos por documento, pelo audit_logs (gravado antes da consulta): pega duas abas simultâneas.
  const desde = new Date(Date.now() - TRAVA_RECONSULTA_MS).toISOString();
  const { data: recentes } = await a.db
    .from("audit_logs")
    .select("new_data")
    .eq("action", "cadastro_analise_juridica")
    .eq("entity_id", id)
    .gte("created_at", desde);
  const jaConsultados = new Set(
    (recentes ?? []).flatMap((r) => ((r as { new_data?: { documentos?: string[] } }).new_data?.documentos ?? [])),
  );
  if (mascarados.some((m) => jaConsultados.has(m))) {
    return NextResponse.json({ error: "Consulta deste documento feita há menos de 5 minutos; aguarde o resultado na tela" }, { status: 409, headers: NO_STORE });
  }

  // Registro ANTES da consulta paga: falhou o log, não consulta.
  const { error: logErr } = await a.db.from("audit_logs").insert({
    user_id: a.user.id,
    user_name: a.nome,
    action: "cadastro_analise_juridica",
    entity: "partner_registrations",
    entity_id: id,
    new_data: { escopo: plano.escopo, documentos: mascarados },
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logErr) {
    console.error("[admin/cadastros/analise-juridica] falha ao gravar log", { code: logErr.code });
    return NextResponse.json({ error: "Não foi possível registrar a consulta, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const resultados = await Promise.all(plano.documentos.map((d) => consultarJuridicoCheckTudo(d.tipo, d.valor)));
  const linhas = plano.documentos.map((d, i) => {
    const r = resultados[i];
    return {
      registration_id: id,
      doc_tipo: d.tipo,
      doc_mascarado: d.exibicao,
      escopo: plano.escopo,
      ok: r.ok,
      resultado: r.ok ? apenasTotais(r.data) : null,
      erro: r.ok ? null : String(r.error).slice(0, 300),
      consultado_por: a.user.id,
      consultado_por_nome: a.nome,
    };
  });
  const { data: gravadas, error } = await a.db.from("partner_registration_juridico").insert(linhas).select(COLUNAS);
  if (error) {
    console.error("[admin/cadastros/analise-juridica] falha ao gravar resultado", { code: error.code });
    return NextResponse.json({ error: "A consulta foi feita, mas o resultado não pôde ser gravado. Avise o suporte antes de consultar de novo." }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ consultas: gravadas ?? [] }, { headers: NO_STORE });
}

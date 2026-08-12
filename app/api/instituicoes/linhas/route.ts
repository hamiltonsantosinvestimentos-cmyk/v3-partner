import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await svc().from("profiles").select("role").eq("id", user.id).single();
    return (data?.role as string) ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.instituicao_id) return NextResponse.json({ error: "instituicao_id é obrigatório" }, { status: 400 });
  if (!body.nome) return NextResponse.json({ error: "Nome da linha é obrigatório" }, { status: 400 });

  const { data, error } = await svc()
    .from("instituicoes_linhas")
    .insert([{
      instituicao_id: body.instituicao_id,
      nome: body.nome,
      categoria: body.categoria ?? null,
      cor: body.cor ?? null,
      emoji: body.emoji ?? null,
      tipo_pessoa: body.tipo_pessoa ?? "AMBOS",
      requer_imovel: body.requer_imovel ?? false,
      bloqueia_restricao: body.bloqueia_restricao ?? true,
      valor_minimo: body.valor_minimo ?? null,
      valor_maximo: body.valor_maximo ?? null,
      ltv_maximo: body.ltv_maximo ?? null,
      min_renda_mensal: body.min_renda_mensal ?? null,
      min_faturamento_mensal: body.min_faturamento_mensal ?? null,
      score_base: body.score_base ?? null,
      keywords_finalidade: body.keywords_finalidade ?? null,
      descricao: body.descricao ?? null,
      observacoes_internas: body.observacoes_internas ?? null,
      ativo: body.ativo ?? true,
      ordem: body.ordem ?? 0,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linha: data });
}

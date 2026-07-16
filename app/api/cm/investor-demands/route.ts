import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const INTERNAL_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !INTERNAL_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// Cadastro manual de comprador direto pela Mesa de Capitais, sem depender do link publico de intake
// (correcao Mesa Operacional 2026-07-15 — "Novo Comprador" deixa de ser so gerador de link)
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado — apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 401 });

  const body = await req.json();
  const {
    nome_contato, email, telefone, empresa, cnpj, cpf,
    nacionalidade, profissao, estado_civil, identidade_orgao, endereco,
    jurisdicao_alvo, natureza_preferida, asset_types_preferidos,
    ticket_min, ticket_max, desagio_min, criterios,
  } = body;

  if (!nome_contato || !email) {
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 422 });
  }

  const { data: demand, error } = await svc()
    .from("investor_demands")
    .insert({
      nome_contato,
      email,
      telefone: telefone || null,
      empresa: empresa || null,
      cnpj: cnpj || null,
      cpf: cpf || null,
      nacionalidade: nacionalidade || null,
      profissao: profissao || null,
      estado_civil: estado_civil || null,
      identidade_orgao: identidade_orgao || null,
      endereco: endereco || null,
      setores: asset_types_preferidos?.length ? asset_types_preferidos : ["precatorio"],
      ufs: jurisdicao_alvo?.length ? jurisdicao_alvo : ["RJ"],
      jurisdicao_alvo: jurisdicao_alvo?.length ? jurisdicao_alvo : null,
      natureza_preferida: natureza_preferida?.length ? natureza_preferida : null,
      asset_types_preferidos: asset_types_preferidos?.length ? asset_types_preferidos : null,
      ticket_min: ticket_min ? Number(ticket_min) : 0,
      ticket_max: ticket_max ? Number(ticket_max) : 99999999,
      desagio_min: desagio_min ? Number(desagio_min) : null,
      tipos_operacao: ["compra"],
      criterios: criterios || null,
      origem: "manual_mesa",
      status: "ativo",
      alerta_ativo: true,
      nda_accepted: true,
      nda_accepted_at: new Date().toISOString(),
      intake_locked: true,
      created_by: caller.userId,
      intake_data: { cadastrado_manualmente_por: caller.userId, cadastrado_em: new Date().toISOString() },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, demand }, { status: 201 });
}

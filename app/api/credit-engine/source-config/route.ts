import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "MESA_OPERACIONAL"] as const; // GESTAO fora, decisão de João (20/07/2026)

const DEFAULTS = {
  receita_federal: true,
  cnj_datajud: true,
  ceis: true,
  registrato_bacen: false,
  serasa: false,
  serasa_modalidade: "simples" as const,
  serasa_cnpj: true,
  serasa_cpf: false,
  serasa_cpf_list: null as string[] | null,
  spc: false,
  escavador: false,
};

async function checkAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Não autorizado" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return { ok: false as const, status: 403, error: "Sem permissão" };
  }
  return { ok: true as const, userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await checkAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const cnpj = searchParams.get("cnpj");
  if (!cnpj) return NextResponse.json({ error: "cnpj obrigatório" }, { status: 422 });

  const svc = serviceClient();
  const { data } = await svc.from("credit_source_configs").select("*").eq("cnpj", cnpj).single();

  if (!data) {
    return NextResponse.json({ success: true, data: { cnpj, razao_social: null, ...DEFAULTS, configured_by: null, updated_at: null, is_default: true } });
  }

  return NextResponse.json({ success: true, data: { ...data, is_default: false } });
}

export async function POST(req: NextRequest) {
  const auth = await checkAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { cnpj, razao_social, receita_federal, cnj_datajud, ceis, registrato_bacen, serasa, serasa_modalidade, serasa_cnpj, serasa_cpf, serasa_cpf_list, spc, escavador } = body;

  if (!cnpj) return NextResponse.json({ error: "cnpj obrigatório" }, { status: 422 });
  if (serasa_cpf === true && (!Array.isArray(serasa_cpf_list) || serasa_cpf_list.length === 0)) {
    return NextResponse.json({ error: "serasa_cpf_list obrigatório quando serasa_cpf = true" }, { status: 422 });
  }

  const svc = serviceClient();
  const { data, error } = await svc.from("credit_source_configs").upsert({
    cnpj,
    razao_social: razao_social ?? null,
    receita_federal: Boolean(receita_federal),
    cnj_datajud: Boolean(cnj_datajud),
    ceis: Boolean(ceis),
    registrato_bacen: Boolean(registrato_bacen),
    serasa: Boolean(serasa),
    serasa_modalidade: serasa_modalidade === "avancada" ? "avancada" : "simples",
    serasa_cnpj: Boolean(serasa_cnpj),
    serasa_cpf: Boolean(serasa_cpf),
    serasa_cpf_list: Boolean(serasa_cpf) ? serasa_cpf_list : null,
    spc: Boolean(spc),
    escavador: Boolean(escavador),
    configured_by: auth.userId,
  }, { onConflict: "cnpj" }).select("id, cnpj, updated_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data });
}

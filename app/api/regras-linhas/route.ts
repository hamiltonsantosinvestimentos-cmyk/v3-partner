import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return { user, profile };
}

// Valores padrão para seed inicial
const DEFAULT_REGRAS = [
  { id: "home_equity",     nome: "Home Equity",                          nivel: "NIVEL_1", categoria: "Crédito com Garantia de Imóvel",          cor: "#3B82F6", emoji: "🏠", tipo_pessoa: "PF",    requer_imovel: true,  bloqueia_restricao: true,  valor_minimo: 50000,    valor_maximo: 5000000,  ltv_maximo: 0.6,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 60, keywords_finalidade: ["imovel","casa","residencial","quitacao"],       descricao: "Crédito pessoal ou empresarial com garantia de imóvel residencial ou comercial. Taxas a partir de 0,89% a.m. Prazo até 240 meses.", observacoes_internas: "" },
  { id: "aval",            nome: "Crédito com Aval",                     nivel: "NIVEL_1", categoria: "Crédito Pessoal Avalizado",               cor: "#8B5CF6", emoji: "🤝", tipo_pessoa: "PF",    requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 5000,     valor_maximo: 500000,   ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 40, keywords_finalidade: ["pessoal","consumo","aval"],                     descricao: "Crédito pessoal com aval de terceiro. Ideal para quem não possui garantia real.",                                                   observacoes_internas: "" },
  { id: "cdc",             nome: "CDC — Crédito Direto ao Consumidor",   nivel: "NIVEL_1", categoria: "Financiamento de Bens",                   cor: "#06B6D4", emoji: "🚗", tipo_pessoa: "AMBOS", requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 10000,    valor_maximo: 500000,   ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 35, keywords_finalidade: ["veiculo","carro","moto","equipamento","maquina","frota"], descricao: "Financiamento de veículos, equipamentos e bens de consumo. O bem financia como garantia.",                                          observacoes_internas: "" },
  { id: "v3giro",          nome: "V3Giro / Capital de Giro",             nivel: "NIVEL_2", categoria: "Capital de Giro Estruturado",             cor: "#F59E0B", emoji: "🔄", tipo_pessoa: "PJ",    requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 100000,   valor_maximo: 5000000,  ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 100000,   score_base: 40, keywords_finalidade: ["giro","capital","fluxo","caixa","operacional"],  descricao: "Capital de giro estruturado para empresas com faturamento comprovado. Prazo 12–36 meses.",                                          observacoes_internas: "" },
  { id: "cgi",             nome: "CGI — Crédito com Garantia Imóvel PJ", nivel: "NIVEL_2", categoria: "Crédito Garantido Real — PJ",              cor: "#10B981", emoji: "🏢", tipo_pessoa: "PJ",    requer_imovel: true,  bloqueia_restricao: true,  valor_minimo: 200000,   valor_maximo: null,     ltv_maximo: 0.6,  min_renda_mensal: 0,       min_faturamento_mensal: 50000,    score_base: 55, keywords_finalidade: ["imobiliario","comercial","industrial","galpao"],  descricao: "Crédito empresarial com garantia de imóvel comercial ou industrial.",                                                               observacoes_internas: "" },
  { id: "receivables",     nome: "Receivables / Antecipação",            nivel: "NIVEL_2", categoria: "Antecipação de Recebíveis",               cor: "#6366F1", emoji: "📄", tipo_pessoa: "PJ",    requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 50000,    valor_maximo: null,     ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 200000,   score_base: 35, keywords_finalidade: ["recebivel","antecip","duplicata","nota fiscal","nf","titulo"], descricao: "Antecipação de recebíveis comerciais, NFs, duplicatas e contratos.",                                                                observacoes_internas: "" },
  { id: "fidc",            nome: "FIDC",                                 nivel: "NIVEL_2", categoria: "Securitização de Crédito",                cor: "#EC4899", emoji: "📊", tipo_pessoa: "PJ",    requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 1000000,  valor_maximo: null,     ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 1000000,  score_base: 20, keywords_finalidade: ["fidc","fundo","securitizacao","carteira"],        descricao: "Estruturação de FIDC para empresas com carteira de recebíveis. Captação via mercado de capitais.",                                  observacoes_internas: "" },
  { id: "cri",             nome: "CRI — Certificado de Recebíveis Imobiliários", nivel: "NIVEL_3", categoria: "Securitização Imobiliária",     cor: "#F97316", emoji: "🏗️", tipo_pessoa: "PJ",    requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 5000000,  valor_maximo: null,     ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 30, keywords_finalidade: ["imov","real estate","built","loteamento","incorpora","cri"], descricao: "Securitização de recebíveis imobiliários. Emissor: Bloxs S.A. Lastro em contratos de locação, compra e venda ou BTS.",             observacoes_internas: "" },
  { id: "cra",             nome: "CRA — Certificado de Recebíveis do Agronegócio", nivel: "NIVEL_3", categoria: "Securitização do Agronegócio", cor: "#84CC16", emoji: "🌾", tipo_pessoa: "PJ",   requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 5000000,  valor_maximo: null,     ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 25, keywords_finalidade: ["agro","rural","soja","milho","cana","pecuaria","fazenda","cra"], descricao: "Securitização de recebíveis do agronegócio. Emissor: Bloxs S.A. Lastro em CPR e contratos agrícolas.",                             observacoes_internas: "" },
  { id: "project_finance", nome: "Project Finance",                      nivel: "NIVEL_3", categoria: "Financiamento Estruturado de Projetos",  cor: "#A855F7", emoji: "🏭", tipo_pessoa: "PJ",    requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 5000000,  valor_maximo: null,     ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 30, keywords_finalidade: ["infraestrutura","energia","mineracao","usina","porto","logistica","projeto"], descricao: "Financiamento de grandes projetos de infraestrutura, energia, mineração e real estate. Fundos asiáticos e americanos.", observacoes_internas: "" },
  { id: "real_estate",     nome: "Real Estate Estruturado",              nivel: "NIVEL_3", categoria: "SLB · BTS · BTR",                        cor: "#0EA5E9", emoji: "🏙️", tipo_pessoa: "AMBOS", requer_imovel: false, bloqueia_restricao: true,  valor_minimo: 5000000,  valor_maximo: null,     ltv_maximo: 1.0,  min_renda_mensal: 0,       min_faturamento_mensal: 0,        score_base: 30, keywords_finalidade: ["slb","sale leaseback","built","bts","btr","galp","lajes","real estate"], descricao: "Sale & Leaseback, Built-to-Suit e Built-to-Rent. Tokenização via Bloxs.",                                                          observacoes_internas: "" },
];

export async function GET() {
  const { data, error } = await svc()
    .from("regras_linhas_credito")
    .select("*")
    .order("nivel")
    .order("id");

  // Se tabela vazia, retorna defaults
  if (!error && (!data || data.length === 0)) {
    return NextResponse.json({ regras: DEFAULT_REGRAS });
  }
  if (error) return NextResponse.json({ regras: DEFAULT_REGRAS });

  return NextResponse.json({ regras: data });
}

export async function PATCH(req: NextRequest) {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  // Upsert — cria ou atualiza
  const { data, error } = await svc()
    .from("regras_linhas_credito")
    .upsert({ id, ...fields, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, regra: data });
}

// Seed inicial — popula a tabela com defaults
export async function POST() {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { error } = await svc()
    .from("regras_linhas_credito")
    .upsert(DEFAULT_REGRAS.map(r => ({ ...r, updated_at: new Date().toISOString() })));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, seeded: DEFAULT_REGRAS.length });
}

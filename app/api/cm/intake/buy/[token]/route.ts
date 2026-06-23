import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id, nome_contato, email, intake_locked, intake_data, nda_accepted")
    .eq("intake_token", token)
    .single();

  if (!demand)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (demand.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  return NextResponse.json({
    demand_id: demand.id,
    prefill: {
      nome_contato: demand.nome_contato !== "Pendente" ? demand.nome_contato : "",
      email: demand.email !== "pendente@pendente.com" ? demand.email : "",
      ...(demand.intake_data as Record<string, unknown> ?? {}),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id, intake_locked")
    .eq("intake_token", token)
    .single();

  if (!demand)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (demand.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  const body = await req.json();
  const {
    nome_contato, email, telefone, empresa, cnpj, cpf,
    nacionalidade, profissao, estado_civil, identidade_orgao, endereco,
    setores, jurisdicao_alvo, natureza_preferida, asset_types_preferidos,
    ticket_min, ticket_max, desagio_min, criterios, nda_accepted,
  } = body;

  if (!nome_contato || !email)
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 422 });

  const { error } = await svc()
    .from("investor_demands")
    .update({
      nome_contato,
      email,
      telefone: telefone ?? null,
      empresa: empresa ?? null,
      cnpj: cnpj ?? null,
      cpf: cpf ?? null,
      nacionalidade: nacionalidade ?? null,
      profissao: profissao ?? null,
      estado_civil: estado_civil ?? null,
      identidade_orgao: identidade_orgao ?? null,
      endereco: endereco ?? null,
      setores: setores?.length ? setores : ["precatorio"],
      ufs: jurisdicao_alvo?.length ? jurisdicao_alvo : ["RJ"],
      jurisdicao_alvo: jurisdicao_alvo ?? null,
      natureza_preferida: natureza_preferida ?? null,
      asset_types_preferidos: asset_types_preferidos ?? null,
      ticket_min: ticket_min ? Number(ticket_min) : 0,
      ticket_max: ticket_max ? Number(ticket_max) : 99999999,
      desagio_min: desagio_min ? Number(desagio_min) : null,
      tipos_operacao: ["compra"],
      criterios: criterios ?? null,
      origem: "intake_buy",
      status: "ativo",
      alerta_ativo: true,
      nda_accepted: nda_accepted ?? false,
      nda_accepted_at: nda_accepted ? new Date().toISOString() : null,
      intake_locked: true,
      intake_data: {
        submitted_at: new Date().toISOString(),
        nda_accepted: nda_accepted ?? false,
      },
    })
    .eq("id", demand.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    message: "Cadastro de interesse recebido. A equipe V3 Partners entrará em contato quando ativos compatíveis estiverem disponíveis.",
  });
}

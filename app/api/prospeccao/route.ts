import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "SDR", "CLOSER", "GESTAO"];

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return profile as { id: string; role: string; full_name: string } | null;
}

/** GET /api/prospeccao — lista todos os leads de prospecção */
export async function GET() {
  const me = await getUser();
  if (!me || !ALLOWED_ROLES.includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();

  const { data: leads, error } = await db
    .from("prospeccao_leads")
    .select(`
      id, nome, documento, email, telefone, cidade, estado,
      origem, indicado_por_nome, indicado_por_partner_id,
      responsavel_id, responsavel_nome,
      etapa, motivo_perda, notas,
      link_token, link_gerado_em,
      convertido_em, comissao_gerada,
      created_at, updated_at, created_by,
      indicado_por_partner:profiles!prospeccao_leads_indicado_por_partner_id_fkey(id, full_name),
      responsavel:profiles!prospeccao_leads_responsavel_id_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Busca lista de usuários SDR/CLOSER/ADMIN para o selector de responsável
  const { data: equipe } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["ADMIN", "SDR", "CLOSER", "GESTAO"])
    .order("full_name");

  // Busca lista de partners para selector de "quem indicou"
  const { data: partners } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .order("full_name")
    .limit(1000);

  return NextResponse.json({
    leads: leads ?? [],
    equipe: equipe ?? [],
    partners: partners ?? [],
  });
}

/** POST /api/prospeccao — cria novo prospect */
export async function POST(req: NextRequest) {
  const me = await getUser();
  if (!me || !ALLOWED_ROLES.includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const {
    nome, documento, email, telefone, cidade, estado,
    origem, indicado_por_partner_id, indicado_por_nome,
    responsavel_id, responsavel_nome, notas,
  } = body as Record<string, string>;

  if (!nome || !origem) {
    return NextResponse.json({ error: "nome e origem são obrigatórios" }, { status: 400 });
  }

  const db = svc();

  // Busca nome do responsável se não foi passado
  let respNome = responsavel_nome ?? null;
  if (responsavel_id && !respNome) {
    const { data: resp } = await db.from("profiles").select("full_name").eq("id", responsavel_id).single();
    respNome = (resp as { full_name: string } | null)?.full_name ?? null;
  }

  const { data, error } = await db
    .from("prospeccao_leads")
    .insert({
      nome,
      documento: documento || null,
      email: email || null,
      telefone: telefone || null,
      cidade: cidade || null,
      estado: estado || null,
      origem,
      indicado_por_partner_id: indicado_por_partner_id || null,
      indicado_por_nome: indicado_por_nome || null,
      responsavel_id: responsavel_id || null,
      responsavel_nome: respNome,
      notas: notas || null,
      etapa: "prospect",
      created_by: me.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Registra histórico
  await db.from("prospeccao_historico").insert({
    lead_id: (data as { id: string }).id,
    etapa_anterior: null,
    etapa_nova: "prospect",
    nota: "Prospect criado",
    created_by: me.id,
  });

  return NextResponse.json({ lead: data }, { status: 201 });
}

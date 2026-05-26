import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCallerUserId(req: NextRequest): Promise<string | null> {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    const { data: admin } = await svc().from("profiles").select("id").eq("role", "ADMIN").limit(1).single();
    return admin?.id ?? "00000000-0000-0000-0000-000000000000";
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return user.id;
}

// GET /api/ma/investor-demands — lista demandas buy-side
export async function GET(req: NextRequest) {
  const userId = await getCallerUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "ativo";

  const query = svc()
    .from("investor_demands")
    .select("*, demand_matches(count)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status !== "all") query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demands: data ?? [] });
}

// POST /api/ma/investor-demands — cria nova demanda buy-side
export async function POST(req: NextRequest) {
  const userId = await getCallerUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    nome_contato, email, telefone, empresa, cnpj,
    setores, ufs, ticket_min, ticket_max,
    tipos_operacao, criterios, origem, notas,
    investor_profile_id,
  } = body;

  if (!nome_contato || !email || !setores?.length || !ticket_min || !ticket_max) {
    return NextResponse.json({ error: "Campos obrigatórios: nome_contato, email, setores, ticket_min, ticket_max" }, { status: 422 });
  }

  const { data: demand, error } = await svc()
    .from("investor_demands")
    .insert({
      investor_profile_id: investor_profile_id ?? null,
      nome_contato, email,
      telefone: telefone ?? null,
      empresa: empresa ?? null,
      cnpj: cnpj ?? null,
      setores: setores ?? [],
      ufs: ufs ?? [],
      ticket_min: Number(ticket_min),
      ticket_max: Number(ticket_max),
      tipos_operacao: tipos_operacao ?? [],
      criterios: criterios ?? null,
      origem: origem ?? "portal",
      notas: notas ?? null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand }, { status: 201 });
}

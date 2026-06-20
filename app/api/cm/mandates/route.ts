import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await svc()
    .from("investor_demands")
    .select("*, cm_buyer_alerts(id, channel, is_active, last_triggered_at), demand_matches(count)")
    .eq("alerta_ativo", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mandates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    nome_contato, email, telefone, empresa,
    setores, ufs, ticket_min, ticket_max,
    jurisdicao_alvo, desagio_min, natureza_preferida,
    asset_types_preferidos, criterios, alert_channel,
  } = body;

  if (!nome_contato || !email || !ticket_min) {
    return NextResponse.json({ error: "Campos obrigatórios: nome_contato, email, ticket_min" }, { status: 422 });
  }

  const { data: demand, error } = await svc()
    .from("investor_demands")
    .insert({
      nome_contato, email,
      telefone: telefone ?? null,
      empresa: empresa ?? null,
      setores: setores ?? [],
      ufs: ufs ?? [],
      ticket_min: Number(ticket_min),
      ticket_max: ticket_max ? Number(ticket_max) : 0,
      tipos_operacao: [],
      jurisdicao_alvo: jurisdicao_alvo ?? null,
      desagio_min: desagio_min ? Number(desagio_min) : null,
      natureza_preferida: natureza_preferida ?? null,
      asset_types_preferidos: asset_types_preferidos ?? null,
      criterios: criterios ?? null,
      alerta_ativo: true,
      origem: "marketplace",
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (demand && alert_channel) {
    await svc().from("cm_buyer_alerts").insert({
      investor_profile_id: demand.investor_profile_id ?? demand.id,
      demand_id: demand.id,
      channel: alert_channel,
      is_active: true,
    });
  }

  return NextResponse.json({ mandate: demand }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { mandate_id, alerta_ativo } = body;

  if (!mandate_id) return NextResponse.json({ error: "mandate_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("investor_demands")
    .update({ alerta_ativo: alerta_ativo ?? false })
    .eq("id", mandate_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mandate: data });
}

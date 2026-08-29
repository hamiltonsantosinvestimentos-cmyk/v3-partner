import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user, profile };
}

// GET — config do agente + etapas do fluxo, na ordem
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [{ data: config, error: configErr }, { data: stages, error: stagesErr }] = await Promise.all([
    svc().from("sdr_flow_config").select("*").eq("id", "default").maybeSingle(),
    svc().from("sdr_flow_stages").select("*").order("ordem", { ascending: true }),
  ]);

  if (configErr || stagesErr) {
    // Tabela ainda não migrada — devolve estado vazio em vez de quebrar a tela.
    return NextResponse.json({ config: null, stages: [], migrated: false });
  }

  return NextResponse.json({ config, stages: stages ?? [], migrated: true });
}

// PATCH — atualiza config do agente (nome, contexto da empresa, regras de comunicação)
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    agente_nome?: string;
    empresa_contexto?: string;
    regras_comunicacao?: string;
    ia_ativa_whatsapp?: boolean;
    ia_ativa_instagram?: boolean;
    ia_ativa_messenger?: boolean;
    ia_ativa_telegram?: boolean;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: auth.user.id };
  if (body.agente_nome !== undefined) update.agente_nome = body.agente_nome;
  if (body.empresa_contexto !== undefined) update.empresa_contexto = body.empresa_contexto;
  if (body.regras_comunicacao !== undefined) update.regras_comunicacao = body.regras_comunicacao;
  if (body.ia_ativa_whatsapp !== undefined) update.ia_ativa_whatsapp = body.ia_ativa_whatsapp;
  if (body.ia_ativa_instagram !== undefined) update.ia_ativa_instagram = body.ia_ativa_instagram;
  if (body.ia_ativa_messenger !== undefined) update.ia_ativa_messenger = body.ia_ativa_messenger;
  if (body.ia_ativa_telegram !== undefined) update.ia_ativa_telegram = body.ia_ativa_telegram;

  const { error } = await svc().from("sdr_flow_config").upsert({ id: "default", ...update });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

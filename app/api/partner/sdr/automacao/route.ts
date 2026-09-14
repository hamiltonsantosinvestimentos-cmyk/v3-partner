import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) return null;
  const db = svc();
  const { data: conexao } = await db.from("partner_sdr_connections").select("addon_ativo").eq("partner_id", user.id).maybeSingle();
  if (!conexao?.addon_ativo) return null;
  return { user };
}

// GET — configuração da própria IA (nome do agente, contexto, regras, liga/desliga)
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: config } = await svc()
    .from("sdr_flow_config")
    .select("agente_nome, empresa_contexto, regras_comunicacao, ia_ativa_whatsapp, ia_ativa_instagram, ia_ativa_messenger, ia_ativa_telegram")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    agente_nome: config?.agente_nome ?? "Assistente",
    empresa_contexto: config?.empresa_contexto ?? "",
    regras_comunicacao: config?.regras_comunicacao ?? "",
    ia_ativa_whatsapp: config?.ia_ativa_whatsapp ?? true,
    ia_ativa_instagram: config?.ia_ativa_instagram ?? true,
    ia_ativa_messenger: config?.ia_ativa_messenger ?? true,
    ia_ativa_telegram: config?.ia_ativa_telegram ?? true,
  });
}

// PUT — atualiza a configuração da própria IA
export async function PUT(req: NextRequest) {
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

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: auth.user.id };
  if (body.agente_nome !== undefined) fields.agente_nome = body.agente_nome.trim() || "Assistente";
  if (body.empresa_contexto !== undefined) fields.empresa_contexto = body.empresa_contexto;
  if (body.regras_comunicacao !== undefined) fields.regras_comunicacao = body.regras_comunicacao;
  if (body.ia_ativa_whatsapp !== undefined) fields.ia_ativa_whatsapp = body.ia_ativa_whatsapp;
  if (body.ia_ativa_instagram !== undefined) fields.ia_ativa_instagram = body.ia_ativa_instagram;
  if (body.ia_ativa_messenger !== undefined) fields.ia_ativa_messenger = body.ia_ativa_messenger;
  if (body.ia_ativa_telegram !== undefined) fields.ia_ativa_telegram = body.ia_ativa_telegram;

  // Achado 15/09/2026: sdr_flow_config.partner_id tem índice único PARCIAL
  // (só WHERE partner_id IS NOT NULL — ver migration
  // 20260823_sdr_whitelabel_partner.sql). upsert(..., {onConflict:
  // "partner_id"}) gera "ON CONFLICT (partner_id)" sem repetir esse WHERE, e
  // Postgres recusa com 42P10 ("no unique or exclusion constraint matching")
  // -- ou seja, TODO partner que tentasse salvar a aba Automação (nome do
  // agente, contexto, regras, os 4 toggles de IA por canal) caía nesse erro,
  // silenciosamente engolido pelo frontend. select+update/insert manual
  // aqui não depende de índice nenhum pra funcionar (a migration
  // 20260915_fix_sdr_flow_config_partner_unique corrige o índice em si, mas
  // este código já funciona sem ela).
  const db = svc();
  const { data: existing } = await db.from("sdr_flow_config").select("partner_id").eq("partner_id", auth.user.id).maybeSingle();

  const { error } = existing
    ? await db.from("sdr_flow_config").update(fields).eq("partner_id", auth.user.id)
    : await db.from("sdr_flow_config").insert({ id: auth.user.id, partner_id: auth.user.id, ...fields });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

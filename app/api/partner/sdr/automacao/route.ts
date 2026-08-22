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
    .select("agente_nome, empresa_contexto, regras_comunicacao, ia_ativa_whatsapp")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    agente_nome: config?.agente_nome ?? "Assistente",
    empresa_contexto: config?.empresa_contexto ?? "",
    regras_comunicacao: config?.regras_comunicacao ?? "",
    ia_ativa_whatsapp: config?.ia_ativa_whatsapp ?? true,
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
  };

  const updates: Record<string, unknown> = { partner_id: auth.user.id, id: auth.user.id, updated_at: new Date().toISOString(), updated_by: auth.user.id };
  if (body.agente_nome !== undefined) updates.agente_nome = body.agente_nome.trim() || "Assistente";
  if (body.empresa_contexto !== undefined) updates.empresa_contexto = body.empresa_contexto;
  if (body.regras_comunicacao !== undefined) updates.regras_comunicacao = body.regras_comunicacao;
  if (body.ia_ativa_whatsapp !== undefined) updates.ia_ativa_whatsapp = body.ia_ativa_whatsapp;

  const { error } = await svc().from("sdr_flow_config").upsert(updates, { onConflict: "partner_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

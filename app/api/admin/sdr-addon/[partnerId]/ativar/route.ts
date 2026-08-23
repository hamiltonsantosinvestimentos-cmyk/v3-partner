import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// PATCH — ativa o add-on pro partner (Hamilton confirmou o pagamento por fora).
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { partnerId } = await params;
  const db = svc();

  const hoje = new Date();
  const proximaCobranca = new Date(hoje);
  proximaCobranca.setDate(proximaCobranca.getDate() + 30);

  const { error } = await db.from("partner_sdr_connections").upsert({
    partner_id: partnerId,
    addon_ativo: true,
    addon_status: "ativo",
    addon_ativado_em: hoje.toISOString(),
    addon_ultimo_pagamento_em: hoje.toISOString().slice(0, 10),
    addon_proxima_cobranca: proximaCobranca.toISOString().slice(0, 10),
    updated_at: hoje.toISOString(),
  }, { onConflict: "partner_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed de uma config de IA neutra pro partner, pra ele nunca cair no
  // fallback genérico sem nem saber que precisa configurar — e principalmente
  // pra NUNCA herdar o PROMPT_PADRAO da V3 (que promoveria a V3 pros clientes dele).
  const { data: configExistente } = await db
    .from("sdr_flow_config")
    .select("partner_id")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!configExistente) {
    await db.from("sdr_flow_config").insert({
      id: partnerId,
      partner_id: partnerId,
      agente_nome: "Assistente",
      empresa_contexto: "",
      regras_comunicacao: "",
    });
  }

  await db.from("notifications").insert({
    user_id: partnerId,
    title: "Atendimento IA no WhatsApp ativado!",
    message: "Seu add-on foi liberado. Configure sua IA e conecte seu WhatsApp.",
    type: "SDR_ADDON_ATIVADO",
    action_url: "/meu-atendimento-ia",
    read: false,
  });

  return NextResponse.json({ ok: true });
}

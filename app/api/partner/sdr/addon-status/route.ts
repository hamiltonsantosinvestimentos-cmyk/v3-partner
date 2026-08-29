import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — status do add-on (não contratado / pedido pendente / ativo). Único
// endpoint de status que NUNCA retorna 403 por falta de add-on — é ele que
// diz se o add-on existe, então tem que responder mesmo sem um ainda.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data: conexao } = await svc()
    .from("partner_sdr_connections")
    .select(`
      addon_ativo, addon_solicitado_em, status,
      messenger_status, instagram_status, instagram_username, meta_page_name, meta_pending_pages,
      telegram_status, telegram_bot_username
    `)
    .eq("partner_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    addon_ativo: conexao?.addon_ativo ?? false,
    addon_solicitado_em: conexao?.addon_solicitado_em ?? null,
    whatsapp_status: conexao?.status ?? "desconectado",
    messenger_status: conexao?.messenger_status ?? "desconectado",
    instagram_status: conexao?.instagram_status ?? "desconectado",
    instagram_username: conexao?.instagram_username ?? null,
    meta_page_name: conexao?.meta_page_name ?? null,
    meta_paginas_pendentes: Array.isArray(conexao?.meta_pending_pages) && conexao.meta_pending_pages.length > 0,
    telegram_status: conexao?.telegram_status ?? "desconectado",
    telegram_bot_username: conexao?.telegram_bot_username ?? null,
  });
}

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
    .select("addon_ativo, addon_solicitado_em, status")
    .eq("partner_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    addon_ativo: conexao?.addon_ativo ?? false,
    addon_solicitado_em: conexao?.addon_solicitado_em ?? null,
    whatsapp_status: conexao?.status ?? "desconectado",
  });
}

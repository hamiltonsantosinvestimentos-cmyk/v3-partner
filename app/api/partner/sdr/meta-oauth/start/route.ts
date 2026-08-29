import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buildOAuthState, buildOAuthUrl } from "@/lib/meta-oauth";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — inicia o OAuth "Conectar com Facebook": confere o add-on, monta o
// state assinado (ver lib/meta-oauth.ts) e redireciona pro dialog da Meta.
// Chamado direto pelo navegador (link/botão "Conectar Instagram/Messenger"
// na aba SDR do partner), não é uma chamada fetch — por isso devolve um
// redirect (303), não JSON.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data: conexao } = await svc()
    .from("partner_sdr_connections")
    .select("addon_ativo")
    .eq("partner_id", user.id)
    .maybeSingle();
  if (!conexao?.addon_ativo) {
    return NextResponse.json({ error: "Add-on de Atendimento IA não contratado" }, { status: 403 });
  }

  try {
    const state = buildOAuthState(user.id);
    return NextResponse.redirect(buildOAuthUrl(state));
  } catch (e) {
    // META_APP_ID/META_APP_SECRET ausente — falha de configuração da V3, não do partner.
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao iniciar conexão" }, { status: 500 });
  }
}

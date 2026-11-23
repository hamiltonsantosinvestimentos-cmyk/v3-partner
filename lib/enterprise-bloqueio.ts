// Telas fora do Enterprise (BRIEF docs/briefs/2026-11-23_enterprise-menu-enxuto-e-comissoes.md):
// Meus Compradores, Meus Ativos, Indicações, Bolsa de Ativos e Atendimento IA. As rotas usadas só por
// essas telas devolvem 403 para o papel ENTERPRISE (master e equipe). Sem sessão: deixa a rota decidir.
import { NextResponse } from "next/server";

export const MENSAGEM_BLOQUEIO_ENTERPRISE = "Recurso indisponível para o seu acesso.";

export function ehEnterprise(role: string | null | undefined): boolean {
  return role === "ENTERPRISE";
}

/** 403 se o usuário logado é ENTERPRISE; null nos demais casos (inclusive sem sessão). */
export async function bloqueioEnterprise(): Promise<NextResponse | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { createClient: sc } = await import("@supabase/supabase-js");
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return ehEnterprise(data?.role as string | null) ? NextResponse.json({ error: MENSAGEM_BLOQUEIO_ENTERPRISE }, { status: 403 }) : null;
  } catch {
    return null;
  }
}

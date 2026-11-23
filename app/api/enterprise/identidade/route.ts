// GET /api/enterprise/identidade — identidade do Enterprise do usuário logado (master ou equipe).
// Partner da V3 e equipe interna recebem { identidade: null } e as telas ficam como hoje.
// Nunca aceita id por parâmetro: o Enterprise sai sempre da sessão. A linha do master é lida com o
// cliente de serviço porque o usuário da equipe não a lê pela RLS.
// BRIEF docs/briefs/2026-11-23_enterprise-identidade-fase1-chat-operacoes-simuladores.md
import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { identidadeDoPerfil } from "@/lib/enterprise-identidade";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const identidade = await identidadeDoPerfil(svc, user.id).catch(() => null);
  return NextResponse.json({ identidade }, { headers: { "Cache-Control": "private, no-store" } });
}

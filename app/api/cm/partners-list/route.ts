import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

/** GET /api/cm/partners-list — lista Partners (PARTNER/PARTNER_PRO) para selecionar Mandatario */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svcClient = svc();
  const { data: caller } = await svcClient.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  // GESTAO/ADMIN incluidos (17/09/2026, pedido de Joao): mesmo motivo do
  // /api/partners -- socio/staff que tambem atua como indicador (ex: Rafael
  // Campos, Auditor de Tokenizacao) precisa aparecer como Mandatario aqui.
  const { data, error } = await svcClient
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["PARTNER", "PARTNER_PRO", "GESTAO", "ADMIN"])
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}

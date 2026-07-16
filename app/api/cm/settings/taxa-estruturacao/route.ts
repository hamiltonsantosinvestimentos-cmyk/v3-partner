import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const INTERNAL_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const SETTINGS_KEY = "cm_divisao_partes_estruturacao";
const DEFAULT_PARTES = 3; // 1/3 compra, 1/3 venda, 1/3 estruturacao

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !INTERNAL_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// GET — le a divisao de partes padrao da estruturacao (1/3 compra, 1/3 venda, 1/3 estruturacao = 3 partes)
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc().from("platform_settings").select("value").eq("key", SETTINGS_KEY).single();
  const divisao_partes = data?.value ? Number(data.value) : DEFAULT_PARTES;

  return NextResponse.json({ divisao_partes });
}

// PATCH — Mesa/ADMIN/GESTAO altera o padrao persistido
export async function PATCH(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { divisao_partes } = body;

  if (divisao_partes === undefined || !Number.isInteger(Number(divisao_partes)) || Number(divisao_partes) < 1) {
    return NextResponse.json({ error: "Campo obrigatório: divisao_partes (inteiro >= 1)" }, { status: 422 });
  }

  const { error } = await svc()
    .from("platform_settings")
    .upsert(
      { key: SETTINGS_KEY, value: String(Number(divisao_partes)), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, divisao_partes: Number(divisao_partes) });
}

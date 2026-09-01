import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { DEFAULT_SLA, type SlaConfig } from "@/lib/mesa-operacional-sla";

const STAFF_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!STAFF_ROLES.includes(profile?.role as typeof STAFF_ROLES[number])) return null;
  return { user };
}

// GET — config de SLA compartilhada (dias por fase). Sem linha ainda = default.
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc().from("mesa_operacional_sla_config").select("config").eq("id", "default").maybeSingle();
  const config: SlaConfig = { ...DEFAULT_SLA, ...(data?.config as Partial<SlaConfig> | undefined) };
  return NextResponse.json({ config });
}

// PUT — atualiza a config compartilhada.
export async function PUT(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as Partial<SlaConfig>;
  const config: SlaConfig = { ...DEFAULT_SLA, ...body };

  const { error } = await svc().from("mesa_operacional_sla_config").upsert({
    id: "default",
    config,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, config });
}

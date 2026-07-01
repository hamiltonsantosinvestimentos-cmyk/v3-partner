import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA"];

// ── GET /api/integrations ──────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { data: partners, error } = await db
    .from("integration_partners")
    .select("id, name, display_name, crm_type, active, sla_days, config_json, api_key_enc, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nunca expor api_key_enc — apenas boolean de presença
  const safe = (partners ?? []).map(({ api_key_enc, ...p }) => ({
    ...p,
    has_api_key: api_key_enc != null && api_key_enc.length > 0,
  }));

  return NextResponse.json({ partners: safe });
}

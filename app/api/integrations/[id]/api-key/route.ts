import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO"];

type RouteContext = { params: Promise<{ id: string }> };

// ── PUT /api/integrations/[id]/api-key ────────────────────────────────────────
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

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
    return NextResponse.json({ error: "Acesso restrito a ADMIN e GESTAO" }, { status: 403 });
  }

  const body = await req.json();
  const { api_key } = body as { api_key?: string };

  if (!api_key?.trim()) {
    return NextResponse.json({ error: "api_key obrigatória" }, { status: 422 });
  }

  const { data, error } = await db
    .from("integration_partners")
    .update({
      api_key_enc: api_key.trim(),
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, display_name, active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    partner: data,
    message: `API key salva. ${data.display_name} ativado com sucesso.`,
  });
}

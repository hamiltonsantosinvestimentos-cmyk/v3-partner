import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

export async function GET() {
  // Público para autenticados — client usa para carregar overrides da trilha
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc().from("academy_onboarding_overrides").select("*");
  return NextResponse.json({ overrides: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json() as {
    step_id: number;
    title?: string;
    description?: string;
    duration?: string;
    video_url?: string;
  };

  if (body.step_id === undefined || body.step_id === null) {
    return NextResponse.json({ error: "step_id obrigatório" }, { status: 400 });
  }

  const { error } = await svc().from("academy_onboarding_overrides").upsert({
    ...body,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "step_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

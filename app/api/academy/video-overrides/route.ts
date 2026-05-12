import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

export async function GET() {
  // Público para autenticados — client usa para carregar overrides
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc().from("academy_video_overrides").select("*");
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
    video_id: string;
    title?: string;
    description?: string;
    instructor?: string;
    instructor_role?: string;
    level?: string;
    duration?: string;
    duration_secs?: number;
    featured?: boolean;
    required?: boolean;
    tags?: string[];
  };

  if (!body.video_id) return NextResponse.json({ error: "video_id obrigatório" }, { status: 400 });

  const { error } = await svc().from("academy_video_overrides").upsert({
    ...body,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "video_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { video_id } = await req.json() as { video_id: string };
  if (!video_id) return NextResponse.json({ error: "video_id obrigatório" }, { status: 400 });

  await svc().from("academy_video_overrides").delete().eq("video_id", video_id);
  return NextResponse.json({ ok: true });
}

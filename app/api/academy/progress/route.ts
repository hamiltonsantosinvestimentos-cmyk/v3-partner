import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — carrega todo o progresso do usuário autenticado
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ progress: {} });

  const { data } = await supabase
    .from("academy_progress")
    .select("video_id, progress_pct")
    .eq("user_id", user.id);

  const progress: Record<string, number> = {};
  (data ?? []).forEach((r) => { progress[r.video_id] = r.progress_pct; });

  return NextResponse.json({ progress });
}

// POST — salva/atualiza progresso de um vídeo (upsert)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { video_id, progress_pct } = await req.json();
  if (!video_id || progress_pct === undefined) {
    return NextResponse.json({ error: "video_id e progress_pct obrigatórios" }, { status: 400 });
  }

  await svc()
    .from("academy_progress")
    .upsert({ user_id: user.id, video_id, progress_pct, updated_at: new Date().toISOString() }, { onConflict: "user_id,video_id" });

  return NextResponse.json({ ok: true });
}

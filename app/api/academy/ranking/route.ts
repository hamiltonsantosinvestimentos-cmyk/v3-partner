import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getAllVideos } from "@/lib/academy-data";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — ranking de engajamento dos partners (admin only)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["ADMIN", "GESTAO"].includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Busca todos os parceiros
  const { data: partners } = await svc()
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .eq("is_active", true);

  if (!partners?.length) return NextResponse.json({ ranking: [] });

  // Busca todo o progresso em batch
  const { data: allProgress } = await svc()
    .from("academy_progress")
    .select("user_id, video_id, progress_pct")
    .in("user_id", partners.map((p) => p.id));

  // Busca certificados
  const { data: allCerts } = await svc()
    .from("academy_certificates")
    .select("user_id, category_id")
    .in("user_id", partners.map((p) => p.id));

  // Mapeia duração por video_id
  const allVideos = getAllVideos();
  const durationMap: Record<string, number> = {};
  allVideos.forEach((v) => { durationMap[v.id] = v.durationSecs; });

  const ranking = partners.map((p) => {
    const progress = (allProgress ?? []).filter((r) => r.user_id === p.id);
    const certs = (allCerts ?? []).filter((c) => c.user_id === p.id);

    const completed = progress.filter((r) => r.progress_pct >= 90).length;
    const inProgress = progress.filter((r) => r.progress_pct > 0 && r.progress_pct < 90).length;
    const watchedSecs = progress.reduce((sum, r) => {
      const dur = durationMap[r.video_id] ?? 0;
      return sum + Math.round((r.progress_pct / 100) * dur);
    }, 0);

    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role,
      completed_videos: completed,
      in_progress_videos: inProgress,
      watched_hours: Math.round(watchedSecs / 3600 * 10) / 10,
      certificates: certs.length,
    };
  });

  ranking.sort((a, b) => b.completed_videos - a.completed_videos || b.watched_hours - a.watched_hours);

  return NextResponse.json({ ranking });
}

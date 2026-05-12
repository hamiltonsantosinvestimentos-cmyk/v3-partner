import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getAllVideos, ACADEMY_CATEGORIES } from "@/lib/academy-data";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [progressRes, certRes] = await Promise.allSettled([
    svc().from("academy_progress").select("user_id, video_id, progress_pct"),
    svc().from("academy_certificates").select("user_id, category_id"),
  ]);

  const allProgress = progressRes.status === "fulfilled" ? (progressRes.value.data ?? []) : [];
  const allCerts = certRes.status === "fulfilled" ? (certRes.value.data ?? []) : [];
  const allVideos = getAllVideos();

  // Per-video stats
  const videoStats = allVideos.map(v => {
    const rows = allProgress.filter((p: { video_id: string }) => p.video_id === v.id);
    const views = rows.length;
    const completed = rows.filter((p: { progress_pct: number }) => p.progress_pct >= 90).length;
    const avgProgress = views > 0 ? Math.round(rows.reduce((s: number, p: { progress_pct: number }) => s + p.progress_pct, 0) / views) : 0;
    return { id: v.id, title: v.title, category: v.category, views, completed, avgProgress, completionRate: views > 0 ? Math.round((completed / views) * 100) : 0 };
  }).sort((a, b) => b.views - a.views);

  // Per-category stats
  const categoryStats = ACADEMY_CATEGORIES.map(cat => {
    const catVideos = cat.videos;
    const certCount = allCerts.filter((c: { category_id: string }) => c.category_id === cat.id).length;
    const avgCompletion = catVideos.length > 0
      ? Math.round(catVideos.reduce((s, v) => {
          const rows = allProgress.filter((p: { video_id: string }) => p.video_id === v.id);
          return s + (rows.length > 0 ? rows.reduce((ss: number, p: { progress_pct: number }) => ss + p.progress_pct, 0) / rows.length : 0);
        }, 0) / catVideos.length)
      : 0;
    return { id: cat.id, label: cat.label, icon: cat.icon, color: cat.color, certCount, avgCompletion, videoCount: catVideos.length };
  });

  // Most abandoned videos (views > 0, low completion rate)
  const abandoned = videoStats
    .filter(v => v.views > 0 && v.completionRate < 50)
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 5);

  // Top performing videos
  const topVideos = videoStats
    .filter(v => v.views > 0)
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5);

  const totalUsers = new Set(allProgress.map((p: { user_id: string }) => p.user_id)).size;
  const totalCompleted = allProgress.filter((p: { progress_pct: number }) => p.progress_pct >= 90).length;

  return NextResponse.json({ videoStats, categoryStats, abandoned, topVideos, totalUsers, totalCompleted, totalCerts: allCerts.length });
}

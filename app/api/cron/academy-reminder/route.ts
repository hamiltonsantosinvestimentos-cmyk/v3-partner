import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getAllVideos } from "@/lib/academy-data";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET /api/cron/academy-reminder — run daily via Vercel Cron
// Sends reminders to partners with stale academy progress (no activity in 7 days)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allVideos = getAllVideos();

  // Partners who have started but not completed all videos
  const { data: partners } = await svc()
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .eq("is_active", true);

  if (!partners || partners.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 });
  }

  // Fetch all progress updated in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentProgress } = await svc()
    .from("academy_progress")
    .select("user_id, video_id, progress_pct, updated_at")
    .gte("progress_pct", 1);

  const progressByUser = new Map<string, typeof recentProgress>();
  for (const row of recentProgress ?? []) {
    const uid = (row as { user_id: string }).user_id;
    if (!progressByUser.has(uid)) progressByUser.set(uid, []);
    progressByUser.get(uid)!.push(row);
  }

  const toRemind: string[] = [];
  const notifications: Array<{ user_id: string; title: string; message: string; type: string; action_url: string; read: boolean }> = [];

  for (const partner of partners) {
    const rows = progressByUser.get(partner.id) ?? [];
    if (rows.length === 0) continue;

    // Check if they have any in-progress videos (>0 but <90)
    const inProgress = rows.filter((r: { progress_pct: number }) => r.progress_pct > 0 && r.progress_pct < 90);
    if (inProgress.length === 0) continue;

    // Check last activity date
    const lastActivity = rows.reduce((latest: string, r: { updated_at: string }) =>
      r.updated_at > latest ? r.updated_at : latest, "");
    const daysSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / 86400000;
    if (daysSinceActivity < 7) continue; // Active recently, skip

    const completedCount = rows.filter((r: { progress_pct: number }) => r.progress_pct >= 90).length;
    const totalVideos = allVideos.length;

    toRemind.push(partner.id);
    notifications.push({
      user_id: partner.id,
      title: "📚 Continue aprendendo no Academy",
      message: `Você tem ${inProgress.length} aula(s) em andamento. Continue de onde parou e complete ${totalVideos - completedCount} aulas restantes para obter seus certificados!`,
      type: "ACADEMY_REMINDER",
      action_url: "/academy",
      read: false,
    });
  }

  if (notifications.length > 0) {
    await svc().from("notifications").insert(notifications);
  }

  return NextResponse.json({ ok: true, reminded: toRemind.length, partners: toRemind });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { BADGE_DEFS } from "@/lib/academy-badges";
import { getAllVideos } from "@/lib/academy-data";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc()
    .from("academy_badges")
    .select("badge_id, awarded_at")
    .eq("user_id", user.id);

  return NextResponse.json({ badges: data ?? [] });
}

// Called after progress/quiz updates to check and award new badges
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Fetch all current data
  const [progressRes, certRes, quizRes, badgesRes] = await Promise.allSettled([
    svc().from("academy_progress").select("video_id, progress_pct").eq("user_id", user.id),
    svc().from("academy_certificates").select("category_id").eq("user_id", user.id),
    svc().from("academy_quiz_results").select("category_id, passed").eq("user_id", user.id).eq("passed", true),
    svc().from("academy_badges").select("badge_id").eq("user_id", user.id),
  ]);

  const progress = progressRes.status === "fulfilled" ? (progressRes.value.data ?? []) : [];
  const certs = certRes.status === "fulfilled" ? (certRes.value.data ?? []) : [];
  const quizPassed = quizRes.status === "fulfilled" ? (quizRes.value.data ?? []) : [];
  const existingBadges = new Set(
    badgesRes.status === "fulfilled" ? (badgesRes.value.data ?? []).map((b: { badge_id: string }) => b.badge_id) : []
  );

  const allVideos = getAllVideos();
  const completedVideos = progress.filter((p: { progress_pct: number }) => p.progress_pct >= 90);
  const watchedSecs = progress.reduce((s: number, p: { progress_pct: number; video_id: string }) => {
    const v = allVideos.find(v => v.id === p.video_id);
    return s + (v ? (p.progress_pct / 100) * v.durationSecs : 0);
  }, 0);
  const watchedHours = watchedSecs / 3600;
  const requiredVideos = allVideos.filter(v => v.required);
  const allRequiredDone = requiredVideos.every(v => (progress.find((p: { video_id: string }) => p.video_id === v.id)?.progress_pct ?? 0) >= 90);
  const { ACADEMY_CATEGORIES } = await import("@/lib/academy-data");

  const toAward: string[] = [];

  const checks: Record<string, boolean> = {
    first_video:    completedVideos.length >= 1,
    "5_videos":     completedVideos.length >= 5,
    "10_videos":    completedVideos.length >= 10,
    "20_videos":    completedVideos.length >= 20,
    all_videos:     completedVideos.length >= allVideos.length,
    first_cert:     certs.length >= 1,
    all_required:   allRequiredDone,
    "5h_watched":   watchedHours >= 5,
    "10h_watched":  watchedHours >= 10,
    all_categories: certs.length >= ACADEMY_CATEGORIES.length,
    quiz_first:     quizPassed.length >= 1,
    quiz_all:       quizPassed.length >= ACADEMY_CATEGORIES.length,
  };

  for (const [badgeId, earned] of Object.entries(checks)) {
    if (earned && !existingBadges.has(badgeId)) {
      toAward.push(badgeId);
    }
  }

  if (toAward.length > 0) {
    await svc().from("academy_badges").insert(
      toAward.map(badge_id => ({ user_id: user.id, badge_id }))
    );
  }

  return NextResponse.json({ awarded: toAward });
}

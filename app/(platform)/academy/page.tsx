import { AcademyClient } from "@/components/academy/academy-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AcademyPageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function AcademyPage({ searchParams }: AcademyPageProps) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole = "PARTNER";
  let userName = "Partner";
  let userId = "";
  let isNew = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, created_at")
      .eq("id", user.id)
      .single();

    userRole = profile?.role ?? "PARTNER";
    userName = profile?.full_name ?? user.email ?? "Partner";
    userId = user.id;

    if (profile?.created_at) {
      const createdAt = new Date(profile.created_at);
      const daysOnPlatform = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      isNew = daysOnPlatform < 30;
    }
  }

  return <AcademyClient initialCategory={params.cat} userRole={userRole} userName={userName} userId={userId} isNew={isNew} />;
}

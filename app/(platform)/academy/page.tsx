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

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    userRole = profile?.role ?? "PARTNER";
    userName = profile?.full_name ?? user.email ?? "Partner";
  }

  return <AcademyClient initialCategory={params.cat} userRole={userRole} userName={userName} />;
}

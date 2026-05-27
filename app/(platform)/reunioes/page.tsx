import { redirect } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import { ReunioesClient } from "@/components/reunioes/reunioes-client";

export const dynamic = "force-dynamic";

export default async function ReunioesPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const svc = sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await svc
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: summaries } = await svc
    .from("meeting_summaries")
    .select("id, title, summary, action_items, participants, duration_minutes, meeting_date, created_at, source, ma_deal_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <ReunioesClient
      profile={{
        id: profile.id,
        full_name: profile.full_name ?? "",
        role: profile.role,
      }}
      initialSummaries={summaries ?? []}
    />
  );
}

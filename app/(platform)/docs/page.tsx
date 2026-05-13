import { createClient as sc } from "@supabase/supabase-js";
import { DocsHubClient } from "@/components/docs/docs-hub-client";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <DocsHubClient
      userRole={profile?.role ?? "PARTNER"}
      userName={profile?.full_name ?? ""}
    />
  );
}

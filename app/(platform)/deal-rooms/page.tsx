import { createClient as sc } from "@supabase/supabase-js";
import { DealRoomsClient } from "@/components/workspaces/deal-rooms-client";

export const dynamic = "force-dynamic";

export default async function DealRoomsPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [profileRes, workspacesRes] = await Promise.all([
    svc.from("profiles").select("full_name, role").eq("id", user.id).single(),
    svc.from("deal_workspaces")
      .select("id, name, context, status, created_at, updated_at")
      .eq("created_by", user.id)
      .neq("status", "arquivado")
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <DealRoomsClient
      workspaces={workspacesRes.data ?? []}
      userRole={profileRes.data?.role ?? "PARTNER"}
      userName={profileRes.data?.full_name ?? ""}
    />
  );
}

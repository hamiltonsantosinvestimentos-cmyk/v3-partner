import { createClient as sc } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { WorkspaceRoomClient } from "@/components/workspaces/workspace-room-client";
import { SQUAD_LIST } from "@/lib/squads";

export const dynamic = "force-dynamic";

export default async function WorkspaceRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [wsRes, sessionsRes, profileRes] = await Promise.all([
    svc.from("deal_workspaces")
      .select("id, name, context, status, synthesis, created_at, updated_at")
      .eq("id", id)
      .eq("created_by", user.id)
      .single(),
    svc.from("agent_sessions")
      .select("id, squad_id, title, messages, created_at, updated_at")
      .eq("workspace_id", id)
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
    svc.from("profiles").select("full_name, role").eq("id", user.id).single(),
  ]);

  if (wsRes.error || !wsRes.data) notFound();

  return (
    <WorkspaceRoomClient
      workspace={wsRes.data}
      sessions={sessionsRes.data ?? []}
      squads={SQUAD_LIST}
      userRole={profileRes.data?.role ?? "PARTNER"}
      userName={profileRes.data?.full_name ?? ""}
    />
  );
}

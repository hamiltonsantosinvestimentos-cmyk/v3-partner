import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

const svcClient = () =>
  sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — workspace + todas as sessões vinculadas
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const svc = svcClient();

  const [wsResult, sessionsResult] = await Promise.all([
    svc.from("deal_workspaces")
      .select("id, name, context, status, deal_id, deal_intake_id, synthesis, created_at, updated_at")
      .eq("id", id)
      .eq("created_by", user.id)
      .single(),

    svc.from("agent_sessions")
      .select("id, squad_id, title, messages, created_at, updated_at")
      .eq("workspace_id", id)
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
  ]);

  if (wsResult.error || !wsResult.data) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    workspace: wsResult.data,
    sessions: sessionsResult.data ?? [],
  });
}

// PATCH — atualiza nome/contexto ou arquiva
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    context?: string;
    status?: string;
  };

  const svc = svcClient();
  const { data, error } = await svc
    .from("deal_workspaces")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("created_by", user.id)
    .select("id, name, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data });
}

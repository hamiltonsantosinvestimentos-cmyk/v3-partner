import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

const svcClient = () =>
  sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — lista workspaces do usuário
export async function GET(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "ativo";

  const svc = svcClient();
  const { data, error } = await svc
    .from("deal_workspaces")
    .select("id, name, context, status, deal_id, deal_intake_id, synthesis, created_at, updated_at")
    .eq("created_by", user.id)
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspaces: data ?? [] });
}

// POST — cria novo workspace
export async function POST(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    context?: string;
    deal_id?: string;
    deal_intake_id?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const svc = svcClient();
  const { data, error } = await svc
    .from("deal_workspaces")
    .insert({
      name: body.name.trim(),
      context: body.context?.trim() ?? null,
      deal_id: body.deal_id ?? null,
      deal_intake_id: body.deal_intake_id ?? null,
      created_by: user.id,
    })
    .select("id, name, context, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data }, { status: 201 });
}

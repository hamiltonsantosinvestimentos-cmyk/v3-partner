import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — list last 20 meetings for the user
export async function GET() {
  let userId: string;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Erro de autenticação" }, { status: 401 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("meeting_summaries")
    .select("id, title, summary, action_items, participants, duration_minutes, meeting_date, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar reuniões" }, { status: 500 });
  }

  return NextResponse.json({ summaries: data ?? [] });
}

// DELETE — delete a meeting (owner only)
export async function DELETE(request: Request) {
  let userId: string;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Erro de autenticação" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID da reunião é obrigatório" }, { status: 400 });
  }

  const svc = serviceClient();
  const { error } = await svc
    .from("meeting_summaries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Erro ao deletar reunião" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

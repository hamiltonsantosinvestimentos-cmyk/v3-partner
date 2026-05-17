import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/tickets/comments?ticket_id=xxx */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticket_id = searchParams.get("ticket_id");
  if (!ticket_id) return NextResponse.json({ error: "ticket_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data, error } = await svc
    .from("ticket_comments")
    .select(`id, content, created_at, author:profiles(id, full_name)`)
    .eq("ticket_id", ticket_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

/** POST /api/tickets/comments */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { ticket_id, content } = await req.json();
  if (!ticket_id || !content?.trim()) {
    return NextResponse.json({ error: "ticket_id e content obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("ticket_comments")
    .insert({ ticket_id, author_id: user.id, content: content.trim() })
    .select(`id, content, created_at, author:profiles(id, full_name)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data }, { status: 201 });
}

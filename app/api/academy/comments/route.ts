import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const videoId = req.nextUrl.searchParams.get("video_id");
  if (!videoId) return NextResponse.json({ error: "video_id obrigatório" }, { status: 400 });

  const { data } = await svc()
    .from("academy_comments")
    .select("id, user_id, comment, author_name, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({ comments: data ?? [], currentUserId: user.id });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { video_id, comment } = await req.json() as { video_id: string; comment: string };
  if (!video_id || !comment?.trim()) {
    return NextResponse.json({ error: "video_id e comment são obrigatórios" }, { status: 400 });
  }
  if (comment.trim().length > 1000) {
    return NextResponse.json({ error: "Comentário muito longo (máx. 1000 caracteres)" }, { status: 400 });
  }

  // Get author name from profiles
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const author_name = (profile as { full_name: string | null } | null)?.full_name ?? "Partner";

  const { data, error } = await svc()
    .from("academy_comments")
    .insert({ user_id: user.id, video_id, comment: comment.trim(), author_name })
    .select("id, user_id, comment, author_name, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // RLS enforces user can only delete own comments
  await svc().from("academy_comments").delete().eq("id", id).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

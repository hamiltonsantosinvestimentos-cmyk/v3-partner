import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — carrega anotações do usuário para um vídeo específico
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ notes: [] });

  const { searchParams } = new URL(req.url);
  const video_id = searchParams.get("video_id");
  if (!video_id) return NextResponse.json({ error: "video_id obrigatório" }, { status: 400 });

  const { data } = await supabase
    .from("academy_notes")
    .select("id, timestamp_secs, note, created_at")
    .eq("user_id", user.id)
    .eq("video_id", video_id)
    .order("timestamp_secs", { ascending: true });

  return NextResponse.json({ notes: data ?? [] });
}

// POST — cria anotação
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { video_id, timestamp_secs, note } = await req.json();
  if (!video_id || !note?.trim()) {
    return NextResponse.json({ error: "video_id e note obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("academy_notes")
    .insert({ user_id: user.id, video_id, timestamp_secs: timestamp_secs ?? 0, note: note.trim() })
    .select("id, timestamp_secs, note, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

// DELETE — remove anotação
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await supabase.from("academy_notes").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

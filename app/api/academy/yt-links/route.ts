import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyByRoles } from "@/lib/notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — retorna todos os links YouTube (público)
export async function GET() {
  const { data } = await svc()
    .from("academy_yt_links")
    .select("video_id, url");

  const links: Record<string, string> = {};
  (data ?? []).forEach((r) => { links[r.video_id] = r.url; });

  return NextResponse.json({ links });
}

// POST — salva/atualiza link de um vídeo (admin)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["ADMIN", "GESTAO"].includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { video_id, url, video_title, is_new } = await req.json();
  if (!video_id || !url) {
    return NextResponse.json({ error: "video_id e url obrigatórios" }, { status: 400 });
  }

  await svc()
    .from("academy_yt_links")
    .upsert({ video_id, url, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "video_id" });

  // Notifica partners quando um novo vídeo é adicionado
  if (is_new && video_title) {
    await notifyByRoles(["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"], {
      title: "Nova aula no Academy! 🎓",
      message: `"${video_title}" já está disponível no V3 Academy.`,
      type: "info",
      action_url: "/academy",
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove link de um vídeo (admin)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["ADMIN", "GESTAO"].includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { video_id } = await req.json();
  if (!video_id) return NextResponse.json({ error: "video_id obrigatório" }, { status: 400 });

  await svc().from("academy_yt_links").delete().eq("video_id", video_id);
  return NextResponse.json({ ok: true });
}

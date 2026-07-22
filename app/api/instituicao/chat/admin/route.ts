import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyChatMensagemInstituicao } from "@/lib/email";

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role as string)) return null;
  return profile as { id: string; full_name: string | null; role: string };
}

// GET /api/instituicao/chat/admin?room_id=instituicao_xxx — busca mensagens (mesa)
export async function GET(request: Request) {
  const profile = await getAdminUser();
  if (!profile) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const room_id = searchParams.get("room_id");
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });

  const { data, error } = await svc()
    .from("chat_messages")
    .select("id, room_id, sender_id, sender_name, sender_role, content, created_at")
    .eq("room_id", room_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

// POST /api/instituicao/chat/admin — mesa envia mensagem para sala de instituição
export async function POST(request: Request) {
  const profile = await getAdminUser();
  if (!profile) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { room_id, content } = await request.json();
  if (!room_id || !content?.trim()) {
    return NextResponse.json({ error: "room_id e content são obrigatórios" }, { status: 400 });
  }

  const { data: msg, error } = await svc()
    .from("chat_messages")
    .insert({
      room_id,
      sender_id: profile.id,
      sender_name: profile.full_name ?? "Mesa V3",
      sender_role: profile.role,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email para a instituição (fire-and-forget)
  const inst_id = room_id.replace("instituicao_", "");
  void Promise.resolve(
    svc()
      .from("instituicoes")
      .select("email, nome")
      .eq("id", inst_id)
      .single()
  ).then(({ data: inst }) => {
    if (inst?.email) {
      void notifyChatMensagemInstituicao({
        instituicaoEmail: inst.email,
        instituicaoNome: inst.nome ?? "Instituição",
        senderName: profile.full_name ?? "Mesa V3",
        preview: content.trim().slice(0, 200),
      }).catch(() => {});
    }
  }).catch(() => {});

  return NextResponse.json({ message: msg }, { status: 201 });
}

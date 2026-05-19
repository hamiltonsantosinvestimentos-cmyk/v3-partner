import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification, notifyByRoles } from "@/lib/notify";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// GET — busca últimas 50 mensagens de um room_id
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const room_id = searchParams.get("room_id");
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });

  // Verifica perfil para checar role
  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | undefined;
  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;

  // Partners só podem acessar a própria sala
  if (!isAdmin && room_id !== `partner_${user.id}`) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data, error } = await svc()
    .from("chat_messages")
    .select("id, room_id, sender_id, sender_name, sender_role, content, created_at")
    .eq("room_id", room_id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [] });
}

// POST — cria uma mensagem
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { room_id, content } = body as { room_id: string; content: string };

  if (!room_id || !content?.trim()) {
    return NextResponse.json({ error: "room_id e content são obrigatórios" }, { status: 400 });
  }

  // Busca perfil do remetente
  const { data: profile } = await svc()
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const role = profile.role as string;
  const isAdmin = ADMIN_ROLES.includes(role);

  // Partners só podem enviar para a própria sala
  if (!isAdmin && room_id !== `partner_${user.id}`) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Insere mensagem
  const { data: msg, error } = await svc()
    .from("chat_messages")
    .insert({
      room_id,
      sender_id: user.id,
      sender_name: profile.full_name ?? "Usuário",
      sender_role: role,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cria notificações assíncronas (fire-and-forget)
  if (isAdmin) {
    // Mensagem de admin/mesa → notifica o partner dono da sala
    const partnerId = room_id.replace("partner_", "");
    createNotification({
      user_id: partnerId,
      title: "Nova mensagem da Mesa V3",
      message: content.trim().slice(0, 80),
      type: "info",
      action_url: "/chat",
    }).catch(() => {});
  } else {
    // Mensagem de partner → notifica admins e gestão
    const partnerName = profile.full_name ?? "Partner";
    notifyByRoles(["ADMIN", "GESTAO"], {
      title: `Mensagem de ${partnerName}`,
      message: content.trim().slice(0, 80),
      type: "info",
      action_url: `/chat/admin?room=${room_id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}

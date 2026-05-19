import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Busca perfil com role e is_socio
  const { data: profile, error: profileError } = await svc()
    .from("profiles")
    .select("id, role, is_socio")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  }

  const role = profile.role as string;
  const isSocio = profile.is_socio === true;

  // Busca todas as salas
  const { data: rooms, error: roomsError } = await svc()
    .from("team_chat_rooms")
    .select("id, name, description, icon, allowed_roles, require_socio")
    .order("id");

  if (roomsError) {
    return NextResponse.json({ error: roomsError.message }, { status: 500 });
  }

  // Filtra salas que o usuário tem acesso
  const accessibleRooms = (rooms ?? []).filter((room) => {
    if (room.require_socio && !isSocio) return false;
    return (room.allowed_roles as string[]).includes(role);
  });

  if (accessibleRooms.length === 0) {
    return NextResponse.json({ rooms: [] });
  }

  const roomIds = accessibleRooms.map((r) => r.id);

  // Busca última mensagem de cada sala
  const lastMessagePromises = roomIds.map(async (roomId) => {
    const { data } = await svc()
      .from("team_chat_messages")
      .select("id, content, sender_name, created_at, attachment_name")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { roomId, lastMessage: data };
  });

  const lastMessages = await Promise.all(lastMessagePromises);
  const lastMessageMap = new Map(lastMessages.map((lm) => [lm.roomId, lm.lastMessage]));

  // Busca contagem de não lidas para o usuário usando last_seen persistido
  // Como não há tabela de last_seen ainda, usamos timestamp de 1 hora atrás como fallback
  // (A contagem exata requer tabela separada de last_seen — omitida para evitar erro de schema)
  const unreadMap = new Map<string, number>();
  // Sem tabela last_seen: unread_count = 0 (será atualizado quando tabela existir)
  for (const roomId of roomIds) {
    unreadMap.set(roomId, 0);
  }

  const result = accessibleRooms.map((room) => {
    const lm = lastMessageMap.get(room.id);
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      icon: room.icon,
      last_message: lm
        ? {
            content: lm.attachment_name ? `📎 ${lm.attachment_name}` : (lm.content ?? ""),
            sender_name: lm.sender_name,
            created_at: lm.created_at,
          }
        : null,
      unread_count: unreadMap.get(room.id) ?? 0,
    };
  });

  return NextResponse.json({ rooms: result });
}

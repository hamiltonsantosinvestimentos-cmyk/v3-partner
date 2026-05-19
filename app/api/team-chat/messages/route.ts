import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — últimas 50 mensagens de uma sala
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const room_id = searchParams.get("room_id");
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });

  // Verifica acesso via função SQL
  const { data: hasAccess, error: accessError } = await svc().rpc(
    "user_can_access_team_room",
    { p_room_id: room_id, p_user_id: user.id }
  );

  if (accessError || !hasAccess) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data, error } = await svc()
    .from("team_chat_messages")
    .select(
      "id, room_id, sender_id, sender_name, sender_role, content, attachment_url, attachment_name, attachment_type, created_at"
    )
    .eq("room_id", room_id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [] });
}

// POST — envia mensagem
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    room_id: string;
    content?: string;
    attachment_url?: string;
    attachment_name?: string;
    attachment_type?: string;
  };

  const { room_id, content, attachment_url, attachment_name, attachment_type } = body;

  if (!room_id) {
    return NextResponse.json({ error: "room_id é obrigatório" }, { status: 400 });
  }

  if (!content?.trim() && !attachment_url) {
    return NextResponse.json(
      { error: "content ou attachment_url é obrigatório" },
      { status: 400 }
    );
  }

  // Verifica acesso à sala
  const { data: hasAccess, error: accessError } = await svc().rpc(
    "user_can_access_team_room",
    { p_room_id: room_id, p_user_id: user.id }
  );

  if (accessError || !hasAccess) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Busca perfil do remetente
  const { data: profile } = await svc()
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const { data: msg, error } = await svc()
    .from("team_chat_messages")
    .insert({
      room_id,
      sender_id: user.id,
      sender_name: profile.full_name ?? "Usuário",
      sender_role: profile.role as string,
      content: content?.trim() ?? null,
      attachment_url: attachment_url ?? null,
      attachment_name: attachment_name ?? null,
      attachment_type: attachment_type ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: msg }, { status: 201 });
}

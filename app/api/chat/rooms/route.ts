import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// GET — lista todas as salas com última mensagem e nome do partner
export async function GET(req: NextRequest) {
  void req;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Verifica se é admin
  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Busca todos os partners ativos
  const { data: partners, error: pErr } = await svc()
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .order("full_name", { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  if (!partners?.length) return NextResponse.json({ rooms: [] });

  // Para cada partner, busca a última mensagem
  const rooms = await Promise.all(
    (partners ?? []).map(async (p: { id: string; full_name: string | null; role: string }) => {
      const room_id = `partner_${p.id}`;
      const { data: msgs } = await svc()
        .from("chat_messages")
        .select("id, content, sender_name, sender_role, created_at")
        .eq("room_id", room_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMsg = msgs?.[0] ?? null;

      // Conta mensagens não lidas de partners (mensagens enviadas pelo próprio partner)
      const { count: unread } = await svc()
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room_id)
        .eq("sender_id", p.id);

      return {
        room_id,
        partner_id: p.id,
        partner_name: p.full_name ?? "Partner",
        partner_role: p.role,
        last_message: lastMsg
          ? {
              content: lastMsg.content,
              sender_name: lastMsg.sender_name,
              created_at: lastMsg.created_at,
            }
          : null,
        unread_count: unread ?? 0,
      };
    })
  );

  // Ordena por última mensagem mais recente primeiro
  rooms.sort((a, b) => {
    if (!a.last_message && !b.last_message) return 0;
    if (!a.last_message) return 1;
    if (!b.last_message) return -1;
    return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
  });

  return NextResponse.json({ rooms });
}

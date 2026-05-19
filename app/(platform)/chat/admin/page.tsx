import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ChatClient, type ChatRoom } from "@/components/chat/chat-client";

export const dynamic = "force-dynamic";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface PageProps {
  searchParams: Promise<{ room?: string }>;
}

export default async function ChatAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profileRaw, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) redirect("/login");

  const profile = profileRaw as { id: string; full_name: string | null; role: string };

  const allowedRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  if (!allowedRoles.includes(profile.role)) {
    redirect("/unauthorized");
  }

  // Busca lista de salas via service role
  const db = svc();

  const { data: partners } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .order("full_name", { ascending: true });

  const rooms: ChatRoom[] = await Promise.all(
    (partners ?? []).map(
      async (p: { id: string; full_name: string | null; role: string }) => {
        const room_id = `partner_${p.id}`;
        const { data: msgs } = await db
          .from("chat_messages")
          .select("id, content, sender_name, sender_role, created_at")
          .eq("room_id", room_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMsg = msgs?.[0] ?? null;

        const { count: unread } = await db
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
                content: lastMsg.content as string,
                sender_name: lastMsg.sender_name as string,
                created_at: lastMsg.created_at as string,
              }
            : null,
          unread_count: unread ?? 0,
        };
      }
    )
  );

  // Ordena por última mensagem mais recente
  rooms.sort((a, b) => {
    if (!a.last_message && !b.last_message) return 0;
    if (!a.last_message) return 1;
    if (!b.last_message) return -1;
    return (
      new Date(b.last_message.created_at).getTime() -
      new Date(a.last_message.created_at).getTime()
    );
  });

  // Determina a sala ativa (query param ou primeira da lista)
  const defaultRoom =
    params.room && rooms.find((r) => r.room_id === params.room)
      ? params.room
      : rooms[0]?.room_id ?? `partner_${user.id}`;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-px h-5 bg-[#C9A84C]" />
          <h1 className="text-[22px] font-bold text-[#F0ECE4] tracking-tight">
            Chat — Mesa V3
          </h1>
        </div>
        <p className="text-[12px] text-[#7A8FA8] ml-4">
          Atendimento direto aos partners da plataforma
        </p>
      </div>

      {rooms.length === 0 ? (
        <div
          className="rounded-2xl border border-[#243A66]/50 flex flex-col items-center justify-center py-20 gap-4"
          style={{ background: "#09081A" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#162744] border border-[#243A66]/50 flex items-center justify-center">
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-[14px] text-[#7A8FA8] font-medium">
            Nenhum partner cadastrado ainda
          </p>
          <p className="text-[11px] text-[#7A8FA8]/50">
            Quando partners se cadastrarem, as salas de chat aparecerão aqui
          </p>
        </div>
      ) : (
        <ChatClient
          roomId={defaultRoom}
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            role: profile.role,
          }}
          isAdmin={true}
          rooms={rooms}
        />
      )}
    </div>
  );
}

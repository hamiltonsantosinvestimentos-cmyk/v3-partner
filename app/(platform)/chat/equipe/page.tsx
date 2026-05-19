import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { TeamChatClient } from "@/components/chat/team-chat-client";

export const dynamic = "force-dynamic";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "MESA", "FINANCEIRO"];

export default async function ChatEquipePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profileRaw, error: profileError } = await svc()
    .from("profiles")
    .select("id, full_name, role, is_socio")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) redirect("/login");

  const profile = profileRaw as {
    id: string;
    full_name: string | null;
    role: string;
    is_socio: boolean | null;
  };

  if (!ALLOWED_ROLES.includes(profile.role)) {
    redirect("/unauthorized");
  }

  // Pré-carrega as salas disponíveis no servidor
  const role = profile.role;
  const isSocio = profile.is_socio === true;

  const { data: allRooms } = await svc()
    .from("team_chat_rooms")
    .select("id, name, description, icon, allowed_roles, require_socio")
    .order("id");

  const rooms = (allRooms ?? [])
    .filter((room) => {
      if (room.require_socio && !isSocio) return false;
      return (room.allowed_roles as string[]).includes(role);
    })
    .map((room) => ({
      id: room.id as string,
      name: room.name as string,
      description: room.description as string | null,
      icon: room.icon as string,
      last_message: null as null,
      unread_count: 0,
    }));

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-px h-5 bg-[#C9A84C]" />
          <h1 className="text-[22px] font-bold text-[#F0ECE4] tracking-tight">
            Chat Interno da Equipe
          </h1>
        </div>
        <p className="text-[12px] text-[#7A8FA8] ml-4">
          Comunicação interna entre os times V3 Partners
        </p>
      </div>

      <TeamChatClient
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        }}
        initialRooms={rooms}
      />
    </div>
  );
}

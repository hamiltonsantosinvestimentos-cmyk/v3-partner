import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "@/components/chat/chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
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

  // Admins são redirecionados para a view admin
  const adminRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  if (adminRoles.includes(profile.role)) {
    redirect("/chat/admin");
  }

  const roomId = `partner_${profile.id}`;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-px h-5 bg-[#C9A84C]" />
          <h1 className="text-[22px] font-bold text-[#F0ECE4] tracking-tight">
            Chat com a Mesa V3
          </h1>
        </div>
        <p className="text-[12px] text-[#7A8FA8] ml-4">
          Converse diretamente com a equipe operacional V3 Partners
        </p>
      </div>

      <ChatClient
        roomId={roomId}
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        }}
        isAdmin={false}
      />
    </div>
  );
}

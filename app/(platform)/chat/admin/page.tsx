import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "@/components/chat/chat-client";
import { ehMesa } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ room?: string }>;
}

// Chat Partners (visão da Mesa). A lista de conversas vem de /api/chat/rooms no cliente.
export default async function ChatAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profileRaw, error: profileError } = await supabase
    .from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (profileError || !profileRaw) redirect("/login");
  const profile = profileRaw as { id: string; full_name: string | null; role: string };
  if (!ehMesa(profile.role)) redirect("/unauthorized");

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-px h-5 bg-[#C9A84C]" />
          <h1 className="text-[22px] font-bold text-[#F0ECE4] tracking-tight">Chat Partners</h1>
        </div>
        <p className="text-[12px] text-[#7A8FA8] ml-4">Atendimento aos partners: fila por tempo de espera, anexos, propostas e sugestão de resposta</p>
      </div>
      <ChatClient
        roomId={params.room ?? ""}
        profile={{ id: profile.id, full_name: profile.full_name, role: profile.role }}
        isAdmin
      />
    </div>
  );
}

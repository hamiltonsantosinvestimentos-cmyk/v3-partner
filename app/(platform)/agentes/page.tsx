import { createClient as sc } from "@supabase/supabase-js";
import { AgentesClient } from "@/components/agentes/agentes-client";
import { SQUAD_LIST } from "@/lib/squads";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

export default async function AgentesPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole = "PARTNER";
  let userName = "";

  if (user) {
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile } = await svc
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    userRole = profile?.role ?? "PARTNER";
    userName = profile?.full_name ?? "";
  }

  if (!ALLOWED_ROLES.includes(userRole)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#7A8FA8] text-sm">Acesso restrito ao time interno V3.</p>
      </div>
    );
  }

  return (
    <AgentesClient
      squads={SQUAD_LIST}
      userRole={userRole}
      userName={userName}
    />
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { UsuariosPageClient } from "@/components/usuarios/usuarios-page-client";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): era um client component puro,
// zero gating no server. /api/usuarios ja e ADMIN-only (sem vazamento de
// dado confirmado), mas a tela nunca deveria renderizar pra quem nao e
// ADMIN. Conteudo original movido para components/usuarios/usuarios-page-
// client.tsx -- este arquivo virou o gate de servidor.
export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (role !== "ADMIN") redirect("/unauthorized");

  return <UsuariosPageClient />;
}

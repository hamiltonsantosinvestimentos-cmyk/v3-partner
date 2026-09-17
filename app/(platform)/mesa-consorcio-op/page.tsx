import { redirect } from "next/navigation";
import { MesaConsorcioClient } from "@/components/mesa-consorcio/mesa-consorcio-client";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (mesma auditoria de acesso): esta pagina nunca lia o
// perfil real, so um cookie de demo legado (v3_demo_session), vazio em
// producao -- todo usuario autenticado, partner incluso, recebia
// userRole="GESTAO" fixo, mostrando controles de admin na tela. As rotas
// /api/consorcio/leads e /api/consorcio/lixeira ja reconferiam a role real
// no servidor (sem vazamento de dado confirmado), mas a tela em si nunca
// deveria ter renderizado pra role nao-interna. Mesmo padrao de redirect
// ja usado nas demais paginas de Mesa.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function MesaConsorcioOpPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const userRole = (profile as { role?: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/unauthorized");

  return <MesaConsorcioClient userRole={userRole} />;
}

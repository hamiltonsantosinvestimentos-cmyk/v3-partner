import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Gate único de acesso pra Server Component de página interna. Criado
 * 18/09/2026 depois da auditoria que achou 12 paginas (mesa-ma, mesa-
 * consorcio-op, bolsa/mesa, marketplace/mesa-capitais, juridico/contratos
 * e assinados, pasta-publica, clientes, admin-marketplace, usuarios, docs,
 * docs/usuario) protegidas só pelo link escondido no sidebar, sem nenhum
 * redirect no servidor -- qualquer usuário autenticado que soubesse a URL
 * via direto. `requireRole()` centraliza a mesma trava numa fonte só, pra
 * nunca mais depender de alguém lembrar de repetir o bloco em cada arquivo.
 *
 * Uso, sempre a primeira linha do componente de página:
 *   const { user, role } = await requireRole(["ADMIN", "GESTAO"]);
 *
 * Nunca use em Client Component nem em rota de API (rotas de API já têm o
 * próprio padrão getCallerRole local, mantido como está).
 */
export async function requireRole(allowedRoles: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await svc()
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role ?? "";
  if (!allowedRoles.includes(role)) redirect("/unauthorized");

  const fullName = (profile as { full_name?: string } | null)?.full_name ?? "";
  return { user, role, fullName };
}

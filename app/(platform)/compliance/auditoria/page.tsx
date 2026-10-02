import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccessAuditClient } from "@/components/compliance/access-audit-client";

export const dynamic = "force-dynamic";

// Auditoria de acessos a dado sensível. SÓ ADMIN: os demais papéis vão para /unauthorized,
// sem confirmar que a tela existe.
export default async function AccessAuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") redirect("/unauthorized");
  return <AccessAuditClient />;
}

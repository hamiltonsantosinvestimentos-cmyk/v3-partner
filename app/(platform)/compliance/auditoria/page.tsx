import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccessAuditClient } from "@/components/compliance/access-audit-client";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";

export const dynamic = "force-dynamic";

// Auditoria de acessos a dado sensível. SÓ ADMIN: os demais papéis vão para /unauthorized,
// sem confirmar que a tela existe.
export default async function AccessAuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") redirect("/unauthorized");
  return (
    <div className="space-y-5">
      <ComplianceTabs userRole={profile.role} active="auditoria" />
      <AccessAuditClient />
    </div>
  );
}

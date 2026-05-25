import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { AssessmentsClient } from "@/components/assessments/assessments-client";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED.includes((profile as { role: string; full_name: string }).role)) redirect("/unauthorized");

  const [{ data: assessments }, { data: meetings }] = await Promise.all([
    svc.from("deal_assessments").select("*").order("created_at", { ascending: false }).limit(50),
    svc.from("business_meetings")
      .select("*, deal_assessments(empresa_nome, instrumento_recomendado)")
      .order("meeting_date", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="p-6">
      <AssessmentsClient
        assessments={assessments ?? []}
        meetings={meetings ?? []}
        role={(profile as { role: string }).role}
        userId={user.id}
      />
    </div>
  );
}

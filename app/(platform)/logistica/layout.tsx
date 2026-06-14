import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { LogisticaTabs } from "@/components/logistica/logistica-tabs";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function LogisticaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();

  if (!ALLOWED.includes(profile?.role ?? "")) redirect("/unauthorized");

  return (
    <div style={{ minHeight: "100vh", background: "#09081A" }}>
      <LogisticaTabs />
      {children}
    </div>
  );
}

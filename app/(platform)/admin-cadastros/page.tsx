import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { AdminCadastrosClient } from "@/components/admin-cadastros/admin-cadastros-client";

export const dynamic = "force-dynamic";

export default async function AdminCadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  // Somente ADMIN
  if (profile?.role !== "ADMIN") redirect("/unauthorized");

  const params = await searchParams;
  const status = params.status ?? "PENDENTE";

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: registrations, error: dbError } = await svc
    .from("partner_registrations")
    .select("*")
    .order("created_at", { ascending: false });

  const all = registrations ?? [];
  const dbReady = !dbError;

  return (
    <AdminCadastrosClient
      registrations={all}
      statusAtivo={status}
      adminName={profile?.full_name ?? "Admin"}
      dbReady={dbReady}
    />
  );
}

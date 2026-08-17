import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { PerfilClient } from "@/components/perfil/perfil-client";

export const metadata = { title: "Meu Perfil — V3 Partners" };

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc
    .from("profiles")
    .select("id, full_name, email, role, avatar_url, phone, document_cpf, nationality, marital_status, profession, created_at, last_login_at, is_active, cobranding_slug, cobranding_bio, cobranding_whatsapp, cobranding_instagram")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <PerfilClient
      initialProfile={{
        ...profile,
        email: profile.email ?? user.email ?? "",
      }}
    />
  );
}

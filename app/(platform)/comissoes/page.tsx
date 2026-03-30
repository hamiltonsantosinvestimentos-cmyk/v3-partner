import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ComissoesPartnerClient } from "@/components/financeiro/comissoes-partner-client";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function ComissoesPage() {
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("v3_demo_session");
    if (!sessionCookie) redirect("/login");

    let session: { id: string; email: string; full_name: string; role: string };
    try { session = JSON.parse(sessionCookie.value); } catch { redirect("/login"); }

    if (!["ADMIN", "PARTNER", "FINANCEIRO"].includes(session.role)) redirect("/unauthorized");

    return (
      <ComissoesPartnerClient
        partnerId={session.id}
        partnerName={session.full_name}
        role={session.role}
      />
    );
  }

  // Production
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !["ADMIN", "PARTNER", "FINANCEIRO"].includes(profile.role)) redirect("/unauthorized");

  return (
    <ComissoesPartnerClient
      partnerId={user.id}
      partnerName={profile.full_name ?? ""}
      role={profile.role}
    />
  );
}

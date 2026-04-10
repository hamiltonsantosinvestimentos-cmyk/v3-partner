import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { KycClient } from "@/components/kyc/kyc-client";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

export default async function KycPage() {
  // ── DEMO MODE ────────────────────────────────────────────────
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("v3_demo_session");
    if (!sessionCookie) redirect("/login");

    let session: { role: string; full_name: string; id: string };
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      redirect("/login");
    }

    if (!ALLOWED_ROLES.includes(session.role)) redirect("/unauthorized");

    return (
      <KycClient
        userRole={session.role as "ADMIN" | "GESTAO"}
        userId={session.id}
      />
    );
  }

  // ── PRODUCTION MODE ──────────────────────────────────────────
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, id")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect("/unauthorized");

  return (
    <KycClient
      userRole={profile.role as "ADMIN" | "GESTAO"}
      userId={profile.id}
    />
  );
}

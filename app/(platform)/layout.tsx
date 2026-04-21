import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PlatformShell } from "@/components/layout/platform-shell";

const IS_DEMO = false;

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ---- DEMO MODE ----
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("v3_demo_session");

    if (!sessionCookie) redirect("/login");

    let session: {
      id: string; email: string; full_name: string;
      role: "ADMIN" | "PARTNER" | "MESA_OPERACIONAL" | "GESTAO" | "FINANCEIRO";
    };

    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      redirect("/login");
    }

    return (
      <PlatformShell
        user={{
          id: session.id,
          full_name: session.full_name,
          email: session.email,
          role: session.role,
          avatar_url: null,
        }}
        notificationCount={3}
      >
        {children}
      </PlatformShell>
    );
  }

  // ---- PRODUCTION MODE ----
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  if (!profileData) redirect("/login");

  const profile = profileData as {
    id: string; email: string; full_name: string | null;
    role: "ADMIN" | "PARTNER" | "MESA_OPERACIONAL" | "GESTAO" | "FINANCEIRO";
    avatar_url: string | null;
  };

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false)
    .catch(() => ({ count: 0 })) as { count: number | null };

  return (
    <PlatformShell
      user={{
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        avatar_url: profile.avatar_url,
      }}
      notificationCount={count ?? 0}
    >
      {children}
    </PlatformShell>
  );
}

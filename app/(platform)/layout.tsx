import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PlatformShell } from "@/components/layout/platform-shell";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";

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
      role: "ADMIN" | "STARTER" | "PARTNER" | "PARTNER_PRO" | "ENTERPRISE" | "MESA_OPERACIONAL" | "GESTAO" | "FINANCEIRO";
    };

    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      redirect("/login");
    }

    return (
      <>
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
        <PWAInstallPrompt />
      </>
    );
  }

  // ---- PRODUCTION MODE ----
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) redirect("/login");

    // Força troca de senha no primeiro acesso
    if (user.app_metadata?.must_change_password) {
      redirect("/auth/update-password?required=true");
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();

    if (profileError || !profileData) redirect("/login");

    // Roles internos não assinam contrato de parceria — mesma lista de app/contrato-parceria/page.tsx.
    // Checar o role ANTES do redirect evita loop infinito dashboard <-> contrato-parceria
    // para quem nunca terá app_metadata.contract_signed=true (ex: GESTAO, ADMIN, MESA_OPERACIONAL).
    const ROLES_INTERNOS = ["ADMIN", "SDR", "CLOSER", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "FORNECEDOR"];
    const isRoleInterno = ROLES_INTERNOS.includes((profileData as { role?: string }).role ?? "");

    // Força assinatura do contrato de parceria (não aplicável a roles internos)
    if (!isRoleInterno && !user.app_metadata?.contract_signed) {
      redirect("/contrato-parceria");
    }

    const profile = profileData as {
      id: string; email: string; full_name: string | null;
      role: "ADMIN" | "STARTER" | "PARTNER" | "PARTNER_PRO" | "ENTERPRISE" | "MESA_OPERACIONAL" | "GESTAO" | "FINANCEIRO";
      avatar_url: string | null;
      trial_expires_at: string | null;
      is_active: boolean | null;
    };

    let notificationCount = 0;
    try {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      notificationCount = count ?? 0;
    } catch {
      // silently ignore notification errors
    }

    return (
      <>
        <PlatformShell
          user={{
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            avatar_url: profile.avatar_url,
            trial_expires_at: profile.trial_expires_at ?? null,
            is_active: profile.is_active ?? null,
          }}
          notificationCount={notificationCount}
        >
          {children}
        </PlatformShell>
        <PWAInstallPrompt />
      </>
    );
  } catch (err) {
    // Re-throw redirect errors (used internally pelo Next.js)
    const digest = (err as { digest?: string })?.digest;
    if (digest?.startsWith("NEXT_REDIRECT") || digest?.startsWith("NEXT_NOT_FOUND")) {
      throw err;
    }
    redirect("/login");
  }
}

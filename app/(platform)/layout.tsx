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
      role: "ADMIN" | "STARTER" | "PARTNER" | "PARTNER_PRO" | "PARTNER_HE" | "ENTERPRISE" | "MESA_OPERACIONAL" | "GESTAO" | "FINANCEIRO";
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

    // Roles internos não passam pelo aviso de contrato — mesma lista de app/contrato-parceria/page.tsx.
    // Checar o role ANTES do redirect evita loop infinito dashboard <-> contrato-parceria
    // para quem nunca terá app_metadata.contract_signed=true (ex: GESTAO, ADMIN, MESA_OPERACIONAL).
    const ROLES_INTERNOS = ["ADMIN", "SDR", "CLOSER", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "FORNECEDOR"];
    const roleAtual = (profileData as { role?: string }).role ?? "";
    const isRoleInterno = ROLES_INTERNOS.includes(roleAtual);

    // Primeiro acesso do partner: mostra só um aviso ("o contrato vem do
    // jurídico em seguida"), não exige mais assinatura dentro da plataforma
    // (decisão do Hamilton, 15/09/2026 — antes só Partner HE tinha esse
    // tratamento, agora vale pra todos os planos). contract_signed continua
    // sendo a flag usada, só que agora marca "já viu o aviso".
    if (!isRoleInterno && !user.app_metadata?.contract_signed) {
      redirect("/contrato-parceria");
    }

    const profile = profileData as {
      id: string; email: string; full_name: string | null;
      role: "ADMIN" | "STARTER" | "PARTNER" | "PARTNER_PRO" | "PARTNER_HE" | "ENTERPRISE" | "MESA_OPERACIONAL" | "GESTAO" | "FINANCEIRO";
      avatar_url: string | null;
      trial_expires_at: string | null;
      is_active: boolean | null;
    };

    // Domínio próprio de Enterprise: só a equipe dele (e a equipe interna da V3, que dá o
    // suporte) usa a plataforma por esse endereço; os demais vão para o domínio da V3.
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const { ehHostV3, enterprisePorDominio } = await import("@/lib/enterprise");
      if (!ehHostV3(host) && !isRoleInterno) {
        const { createClient: sc } = await import("@supabase/supabase-js");
        const svcDom = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const dono = await enterprisePorDominio(svcDom, host);
        const minhaEquipe = (profileData as { enterprise_id?: string | null }).enterprise_id ?? profile.id;
        if (dono && dono.masterId !== minhaEquipe) {
          redirect(`${process.env.NEXT_PUBLIC_APP_URL || "https://app.v3partners.com.br"}/dashboard`);
        }
      }
    } catch (e) {
      const dg = (e as { digest?: string })?.digest;
      if (dg?.startsWith("NEXT_REDIRECT")) throw e;
    }

    // Enterprise white label (lib/enterprise.ts): marca do master para ele e os usuários; o
    // usuário não tem assinatura própria — o acesso segue a do master (trial/ativo).
    let marca: { nome: string; logoUrl: string | null } | null = null;
    let trialExpiresAt = profile.trial_expires_at ?? null;
    let isActive = profile.is_active ?? null;
    if (profile.role === "ENTERPRISE") {
      try {
        const { createClient: sc } = await import("@supabase/supabase-js");
        const { contextoEnterprise } = await import("@/lib/enterprise");
        const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const ctx = await contextoEnterprise(svc, {
          id: profile.id, role: profile.role, enterprise_id: (profileData as { enterprise_id?: string | null }).enterprise_id ?? null,
        });
        marca = ctx?.marca ?? null;
        if (ctx && !ctx.ehMaster) {
          const { data: master } = await svc.from("profiles").select("trial_expires_at, is_active").eq("id", ctx.masterId).maybeSingle();
          trialExpiresAt = (master?.trial_expires_at as string | null) ?? null;
          isActive = profile.is_active === false ? false : ((master?.is_active as boolean | null) ?? null);
        }
      } catch {
        // white label é cosmético: falha aqui nunca derruba a plataforma
      }
    }

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
            trial_expires_at: trialExpiresAt,
            is_active: isActive,
          }}
          marca={marca}
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

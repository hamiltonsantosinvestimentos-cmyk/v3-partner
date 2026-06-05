import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — admin: lista todos partners com progresso de onboarding
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const adminRoles = ["ADMIN", "GESTAO"];
  if (!me || !adminRoles.includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Busca todos os partners
  const { data: partners } = await svc()
    .from("profiles")
    .select("id, full_name, email, role, created_at, is_active, trial_expires_at")
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .order("created_at", { ascending: false });

  if (!partners || partners.length === 0) {
    return NextResponse.json({ partners: [] });
  }

  // Para cada partner, busca contagens de CRM e propostas em paralelo
  const enriched = await Promise.all(
    partners.map(async (p: { id: string; full_name: string | null; email: string; role: string; created_at: string; is_active: boolean; trial_expires_at: string | null }) => {
      const [crmRes, propRes] = await Promise.allSettled([
        svc()
          .from("crm_leads")
          .select("*", { count: "exact", head: true })
          .eq("created_by", p.id),
        svc()
          .from("credit_desk_proposals")
          .select("*", { count: "exact", head: true })
          .or(`created_by.eq.${p.id},partner_id.eq.${p.id}`),
      ]);

      const crmLeads = crmRes.status === "fulfilled" ? (crmRes.value.count ?? 0) : 0;
      const proposals = propRes.status === "fulfilled" ? (propRes.value.count ?? 0) : 0;

      // Busca metadados do auth (welcome_email_sent + last_sign_in_at + localização)
      let welcomeEmailSent = false;
      let lastSignInAt: string | null = null;
      let location: { city: string | null; state: string | null; country: string | null; denied: boolean; updatedAt: string | null } | null = null;
      try {
        const { data: authUser } = await svc().auth.admin.getUserById(p.id);
        const meta = authUser?.user?.user_metadata ?? {};
        welcomeEmailSent = meta.welcome_email_sent ?? false;
        lastSignInAt = authUser?.user?.last_sign_in_at ?? null;

        if (meta.location_city || meta.location_denied !== undefined) {
          location = {
            city: meta.location_city ?? null,
            state: meta.location_state ?? null,
            country: meta.location_country ?? null,
            denied: meta.location_denied === true,
            updatedAt: meta.location_updated_at ?? meta.location_denied_at ?? null,
          };
        }
      } catch { /* silent */ }

      const steps = {
        welcome_email: welcomeEmailSent,
        profile: !!(p.full_name && p.full_name.trim().length > 0),
        crm: crmLeads > 0,
        proposta: proposals > 0,
      };

      const completedCount = Object.values(steps).filter(Boolean).length;
      const totalSteps = Object.keys(steps).length;
      const progress = Math.round((completedCount / totalSteps) * 100);

      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        created_at: p.created_at,
        is_active: p.is_active,
        trial_expires_at: p.trial_expires_at,
        last_sign_in_at: lastSignInAt,
        steps,
        progress,
        crmLeads,
        proposals,
        location,
      };
    })
  );

  return NextResponse.json({ partners: enriched });
}

// POST — admin: envia lembrete de onboarding para um partner específico
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const adminRoles = ["ADMIN", "GESTAO"];
  if (!me || !adminRoles.includes(me.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { partner_id, step } = await req.json();
  if (!partner_id) return NextResponse.json({ error: "partner_id obrigatório" }, { status: 400 });

  const { data: partner } = await svc()
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", partner_id)
    .single();

  if (!partner) return NextResponse.json({ error: "Partner não encontrado" }, { status: 404 });

  try {
    const { notifyLembreteOnboardingEtapa } = await import("@/lib/email");
    await notifyLembreteOnboardingEtapa({
      partnerEmail: partner.email,
      partnerName: partner.full_name || "Parceiro",
      plano: partner.role,
      step: step ?? "profile",
    });
  } catch {
    // silent
  }

  return NextResponse.json({ ok: true });
}

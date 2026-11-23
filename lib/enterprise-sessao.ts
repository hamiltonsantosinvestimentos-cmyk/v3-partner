import { cache } from "react";
import { nomeDaMarca, type EnterpriseContexto } from "@/lib/enterprise";

/**
 * White label da sessão atual (master ou usuário Enterprise), com cache por requisição: o layout da
 * plataforma e o generateMetadata reaproveitam a mesma busca. Nunca lança nem redireciona: qualquer
 * falha = null (visual e título da V3). BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md
 */
export const whiteLabelDaSessao = cache(async (): Promise<(EnterpriseContexto & { nome: string }) | null> => {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { createClient: sc } = await import("@supabase/supabase-js");
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: p } = await svc.from("profiles").select("id, role, enterprise_id").eq("id", user.id).maybeSingle();
    if (!p || p.role !== "ENTERPRISE") return null;
    const { contextoEnterprise } = await import("@/lib/enterprise");
    const ctx = await contextoEnterprise(svc, p as { id: string; role: string; enterprise_id: string | null });
    return ctx ? { ...ctx, nome: nomeDaMarca(ctx) } : null;
  } catch {
    return null;
  }
});

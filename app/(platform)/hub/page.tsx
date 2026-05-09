import { createClient as sc } from "@supabase/supabase-js";
import { HubClient, type HubDeal } from "@/components/hub/hub-client";

export const dynamic = "force-dynamic";

const FULL_ROLES = ["ADMIN"];
const TEAM_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

export default async function HubPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let deals: HubDeal[] = [];
  let userRole = "PARTNER";
  let userName = "";

  if (user) {
    const svc = sc(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await svc
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    userRole = profile?.role ?? "PARTNER";
    userName = profile?.full_name ?? "";

    if (!TEAM_ROLES.includes(userRole)) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-[#7A8FA8] text-sm">Acesso restrito ao time interno.</p>
        </div>
      );
    }

    const isFull = FULL_ROLES.includes(userRole);

    const select = isFull
      ? "id, empresa_nome, setor, valor_estimado, tipo_operacao, origem_lead, sugestao_tese, status, deal_card_html, created_at, contato_nome, contato_telefone, contato_email"
      : "id, empresa_nome, setor, valor_estimado, tipo_operacao, origem_lead, sugestao_tese, status, deal_card_html, created_at";

    const { data, error } = await svc
      .from("deal_intakes")
      .select(select)
      .order("created_at", { ascending: false });

    if (error) console.error("[hub/page] query error:", error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deals = (data ?? []).map((d: any): HubDeal => ({
      id:              d.id,
      empresa_nome:    d.empresa_nome,
      setor:           d.setor,
      valor_estimado:  d.valor_estimado,
      tipo_operacao:   d.tipo_operacao,
      origem_lead:     d.origem_lead,
      sugestao_tese:   d.sugestao_tese ?? "",
      status:          d.status,
      deal_card_html:  d.deal_card_html ?? null,
      created_at:      d.created_at,
      contato_nome:    isFull ? (d.contato_nome ?? null) : null,
      contato_telefone: isFull ? (d.contato_telefone ?? null) : null,
      contato_email:   isFull ? (d.contato_email ?? null) : null,
    }));
  }

  return (
    <HubClient
      deals={deals}
      userRole={userRole}
      userName={userName}
    />
  );
}

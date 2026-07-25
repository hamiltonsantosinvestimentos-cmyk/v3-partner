import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const STAGE_ORDER = [
  "FPA Compra",
  "Carta de Intencao de Compra (Matching)",
  "FPA Venda (Acordo de Protecao de Honorarios)",
  "Contrato de Compra e Venda de Ativo Naval",
] as const;

export type StageStatus = {
  templateName: string;
  label: string;
  status: "nao_iniciado" | "rascunho" | "enviado_assinatura" | "assinado";
  contractId: string | null;
};

export type OperacaoTimeline = {
  dealId: string;
  dealCode: string;
  stages: StageStatus[];
};

const LABELS: Record<string, string> = {
  "FPA Compra": "FPA Compra",
  "Carta de Intencao de Compra (Matching)": "Carta de Intenção",
  "FPA Venda (Acordo de Protecao de Honorarios)": "FPA Venda",
  "Contrato de Compra e Venda de Ativo Naval": "Contrato de Venda",
};

// GET — lista todas as operações M&A com fluxo de intake público
// (deal_room_invite vinculado), agrupadas por deal, com as 4 etapas da
// esteira (FPA Compra, Carta de Intenção, FPA Venda, Contrato de Venda) e
// o status atual de cada uma, para a timeline unificada do painel.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: contracts, error } = await db
    .from("operation_contracts")
    .select("id, deal_id, status_signature, template_id, contract_title, created_at, parties")
    .eq("vertical", "ma")
    .not("deal_room_invite_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contracts || contracts.length === 0) return NextResponse.json({ operacoes: [] });

  // FPA Compra não tem template_id (é cadastro puro), identificado pelo
  // prefixo do contract_title em vez disso.
  const templateIds = [...new Set(contracts.map(c => c.template_id).filter(Boolean))];
  const { data: templates } = await db.from("contract_templates").select("id, template_name").in("id", templateIds as string[]);
  const templateNameById = new Map((templates ?? []).map(t => [t.id, t.template_name]));

  const dealIds = [...new Set(contracts.map(c => c.deal_id).filter(Boolean))];
  const { data: deals } = await db.from("ma_deals").select("id, v3_code, legacy_code").in("id", dealIds as string[]);
  const dealCodeById = new Map((deals ?? []).map(d => [d.id, d.v3_code ?? d.legacy_code ?? d.id]));

  const byDeal = new Map<string, typeof contracts>();
  for (const c of contracts) {
    if (!c.deal_id) continue;
    const list = byDeal.get(c.deal_id) ?? [];
    list.push(c);
    byDeal.set(c.deal_id, list);
  }

  const operacoes: OperacaoTimeline[] = [...byDeal.entries()].map(([dealId, dealContracts]) => {
    const stages: StageStatus[] = STAGE_ORDER.map(templateName => {
      const match = dealContracts.find(c =>
        templateName === "FPA Compra"
          ? c.contract_title.startsWith("FPA Compra")
          : templateNameById.get(c.template_id ?? "") === templateName
      );
      return {
        templateName,
        label: LABELS[templateName],
        status: match ? (match.status_signature as StageStatus["status"]) : "nao_iniciado",
        contractId: match?.id ?? null,
      };
    });
    return { dealId, dealCode: dealCodeById.get(dealId) ?? dealId, stages };
  });

  return NextResponse.json({ operacoes });
}

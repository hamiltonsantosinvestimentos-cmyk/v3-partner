import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function requireRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return true;
}

// GET /api/cm/qualifications/pending -- (11/09/2026, pedido de João: "aonde
// consigo ver os contratos pendentes aguardando qualificação? isso não está
// previsto no UX?"). Gap real: cada lote só era visível entrando na minuta/
// card específico que o criou (Minutas, ou o painel de indicações da Bolsa
// de Ativos) -- nenhuma tela agregava os lotes em aberto do sistema
// inteiro. O cron de lembrete (cron/qualification-reminder) já faz essa
// varredura pra cobrar automaticamente, essa rota reaproveita o mesmo
// filtro de status pra virar uma tela de acompanhamento.
export async function GET(_req: NextRequest) {
  const caller = await requireRole();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await svc()
    .from("cm_qualification_batches")
    .select(`
      id, document_type, status, created_at, completed_at, reminder_count, last_reminder_sent_at,
      template_id, listing_id, demand_id, operation_contract_id,
      contract_templates(id, template_name, vertical),
      cm_asset_listings(anonymous_id, seller_name),
      investor_demands(empresa, nome_contato),
      linked_contract:operation_contracts!operation_contract_id(contract_code, contract_title),
      cm_party_qualifications(id, full_name, status)
    `)
    .is("consumido_por_contract_id", null)
    .in("status", ["coletando", "completo"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: data ?? [] });
}

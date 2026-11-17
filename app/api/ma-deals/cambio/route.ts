import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { fetchFxRate } from "@/lib/ma/bp-intake/engine/fx-service";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const bodySchema = z.object({ id: z.string().uuid("ID inválido") });

// "dd/mm/aaaa" (BCB) ou "aaaa-mm-dd ..." (AwesomeAPI) para "aaaa-mm-dd".
function toIsoDate(raw: string): string {
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : new Date().toISOString().slice(0, 10);
}

// POST /api/ma-deals/cambio { id }: grava o câmbio do dia (USD para BRL, PTAX do BCB) no card.
// O deal_value continua na moeda do ativo; o câmbio só alimenta o equivalente em reais.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const { id } = parsed.data;

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("id, role").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? "");

  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, currency, assigned_to, created_by")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
  if (!isAdmin && deal.assigned_to !== user.id && deal.created_by !== user.id) {
    return NextResponse.json({ error: "Sem permissão para este deal" }, { status: 403 });
  }

  const moeda = deal.currency ?? "BRL";
  if (moeda !== "USD") {
    return NextResponse.json({ error: "Atualizar câmbio só se aplica a ativos em dólar americano." }, { status: 422 });
  }

  const fx = await fetchFxRate();
  // "fallback" é um valor fixo de reserva, nunca uma cotação: não grava dado inventado.
  if (fx.source === "fallback") {
    return NextResponse.json({ error: "Cotação indisponível agora (BCB e AwesomeAPI não responderam). Tente novamente em instantes." }, { status: 502 });
  }

  const fxDate = toIsoDate(fx.date);
  const { error } = await svc
    .from("ma_deals")
    .update({ fx_rate_brl: fx.usd_brl, fx_rate_date: fxDate, fx_rate_source: fx.source, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "ma_deals",
    entityId: id,
    newData: { motivo: "cambio_atualizado", fx_rate_brl: fx.usd_brl, fx_rate_date: fxDate, source: fx.source },
  });

  return NextResponse.json({ ok: true, fx_rate_brl: fx.usd_brl, fx_rate_date: fxDate, fx_rate_source: fx.source });
}

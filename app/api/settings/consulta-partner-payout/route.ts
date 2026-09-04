import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const WRITE_ROLES = ["ADMIN", "GESTAO", "FINANCEIRO"];
const SETTINGS_KEY = "consulta_partner_payout_cents";

async function getCaller(requireWriteRole: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  if (requireWriteRole && !WRITE_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// GET — valor fixo (centavos) direcionado ao partner por consulta entregue
export async function GET() {
  const caller = await getCaller(false);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc()
    .from("platform_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  const raw = data?.value != null ? Number(data.value) : 0;
  const payout_cents = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
  return NextResponse.json({ payout_cents, payout_reais: payout_cents / 100 });
}

// PATCH — ADMIN/GESTAO/FINANCEIRO altera o valor
export async function PATCH(req: NextRequest) {
  const caller = await getCaller(true);
  if (!caller) return NextResponse.json({ error: "Sem permissão para alterar este valor." }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const b = body as Record<string, unknown>;

  // Aceita payout_cents (inteiro) ou payout_reais (decimal em R$)
  let cents: number | null = null;
  if (b.payout_cents !== undefined && b.payout_cents !== null && b.payout_cents !== "") {
    cents = Math.round(Number(b.payout_cents));
  } else if (b.payout_reais !== undefined && b.payout_reais !== null && b.payout_reais !== "") {
    cents = Math.round(Number(String(b.payout_reais).replace(",", ".")) * 100);
  }

  if (cents === null || Number.isNaN(cents) || cents < 0 || cents > 100_000_00) {
    return NextResponse.json({ error: "Informe um valor entre R$ 0 e R$ 100.000." }, { status: 422 });
  }

  const { error } = await svc()
    .from("platform_settings")
    .upsert(
      { key: SETTINGS_KEY, value: String(cents), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, payout_cents: cents, payout_reais: cents / 100 });
}

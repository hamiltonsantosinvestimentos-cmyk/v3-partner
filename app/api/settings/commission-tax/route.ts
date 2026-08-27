import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const WRITE_ROLES = ["ADMIN", "GESTAO", "FINANCEIRO"];
const SETTINGS_KEY = "commission_tax_percent";
const DEFAULT_TAX = 0;

async function getCaller(requireWriteRole: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  if (requireWriteRole && !WRITE_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// GET — alíquota global de imposto sobre comissões (%)
export async function GET() {
  const caller = await getCaller(false);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc()
    .from("platform_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  const tax_percent = data?.value != null ? Number(data.value) : DEFAULT_TAX;
  return NextResponse.json({ tax_percent: Number.isFinite(tax_percent) ? tax_percent : DEFAULT_TAX });
}

// PATCH — ADMIN/GESTAO/FINANCEIRO altera a alíquota global
export async function PATCH(req: NextRequest) {
  const caller = await getCaller(true);
  if (!caller) return NextResponse.json({ error: "Sem permissão para alterar a alíquota." }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const raw = (body as Record<string, unknown>).tax_percent;
  const n = Number(raw);

  if (raw === undefined || raw === null || raw === "" || Number.isNaN(n) || n < 0 || n > 100) {
    return NextResponse.json({ error: "Informe uma alíquota entre 0 e 100." }, { status: 422 });
  }

  const value = String(Math.round(n * 100) / 100);

  const { error } = await svc()
    .from("platform_settings")
    .upsert(
      { key: SETTINGS_KEY, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tax_percent: Number(value) });
}

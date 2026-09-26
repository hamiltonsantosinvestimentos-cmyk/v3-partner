import { NextResponse } from "next/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { contextoEnterprise, type EnterpriseContexto } from "@/lib/enterprise";

export const svcEnterprise = (): SupabaseClient =>
  sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Usuário logado + contexto Enterprise; devolve 401/403 pronto quando não é Enterprise. */
export async function exigirEnterprise(opts: { somenteMaster?: boolean } = {}): Promise<
  | { ok: true; userId: string; nome: string | null; ctx: EnterpriseContexto; db: SupabaseClient }
  | { ok: false; res: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const db = svcEnterprise();
  const { data: perfil } = await db.from("profiles").select("id, role, enterprise_id, full_name").eq("id", user.id).single();
  const ctx = perfil ? await contextoEnterprise(db, perfil) : null;
  if (!ctx) return { ok: false, res: NextResponse.json({ error: "Disponível apenas para Enterprise" }, { status: 403 }) };
  if (opts.somenteMaster && !ctx.ehMaster) {
    return { ok: false, res: NextResponse.json({ error: "Apenas o usuário master do Enterprise" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id, nome: (perfil?.full_name as string | null) ?? null, ctx, db };
}

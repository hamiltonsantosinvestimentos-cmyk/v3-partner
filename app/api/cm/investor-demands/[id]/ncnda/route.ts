import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getDemandNcndaState } from "@/lib/cm-ncnda";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

/** GET /api/cm/investor-demands/[id]/ncnda
 *  Fase 5, 5.3 (20/09/2026): onde esta o NCNDA de um comprador (lote de qualificacao,
 *  contrato gerado, assinatura). Alimenta o bloco "NCNDA do Comprador" do card e o
 *  bloqueio do botao "Registrar NCNDA assinado". So Mesa: o Partner de origem nao ve
 *  contrato nem dado de qualificacao do comprador (Blind Wall). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !MESA_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });
  }

  const { id } = await params;
  const { data: demand } = await db.from("investor_demands").select("id").eq("id", id).maybeSingle();
  if (!demand) return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });

  return NextResponse.json(await getDemandNcndaState(db, id));
}

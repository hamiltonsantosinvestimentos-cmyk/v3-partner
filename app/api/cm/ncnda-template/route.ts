import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveBolsaNcndaTemplate } from "@/lib/cm-ncnda";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

/** GET /api/cm/ncnda-template
 *  Minuta aprovada do NCNDA da Bolsa de Ativos (ver lib/cm-ncnda.ts pelo criterio de escolha).
 *  Usada pelos botoes "Gerar NCNDA" do ativo (venda) e do comprador, para os dois lados
 *  resolverem a MESMA minuta em vez de cada tela escolher por conta propria. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !MESA_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });
  }

  const template = await resolveBolsaNcndaTemplate(db);
  if (!template) {
    return NextResponse.json(
      { error: "Nenhuma minuta de NCNDA aprovada para Bolsa de Ativos. Verifique a Revisão Jurídica em Central de Contratos." },
      { status: 404 }
    );
  }
  return NextResponse.json({ template });
}

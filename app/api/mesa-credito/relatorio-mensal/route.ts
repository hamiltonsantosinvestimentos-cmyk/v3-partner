import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { enviarRelatorioMensal, periodoDoMes } from "@/lib/relatorio-mensal-partners";

export const maxDuration = 300;

// POST { mes: "YYYY-MM" } — ADMIN/GESTAO reenvia os e-mails do relatório mensal daquele mês
// (partners + sócios) pela tela /mesa-credito/relatorio-mensal.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { mes?: string };
  const periodo = periodoDoMes(body.mes);
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const r = await enviarRelatorioMensal(db, periodo, { forcar: true });
  return NextResponse.json({ periodo: periodo.chave, ...r });
}

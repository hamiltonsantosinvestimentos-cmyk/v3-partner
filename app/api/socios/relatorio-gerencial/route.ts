import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { gerarRelatorioGerencial } from "@/lib/mesa-relatorio-gerencial";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// BRIEF "Painel de Governança da Diretoria (/socios)", 05/09/2026, "Go".
// Geração sob demanda do Relatório Gerencial, restrita a ADMIN (os 3
// sócios), reaproveitando exatamente a mesma lib do cron agendado
// (lib/mesa-relatorio-gerencial.ts) — nunca duplicada.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Restrito a ADMIN" }, { status: 403 });
  }

  const { period, mesa } = await req.json().catch(() => ({}));

  const result = await gerarRelatorioGerencial(period, mesa);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
}

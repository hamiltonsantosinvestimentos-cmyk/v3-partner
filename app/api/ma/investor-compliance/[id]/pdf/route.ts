import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { generateAndStoreInvestorComplianceReportPdf } from "@/lib/investor-compliance-report-generate";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(supabaseUser: { id: string } | null) {
  if (!supabaseUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: profile } = await svc().from("profiles").select("role").eq("id", supabaseUser.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { userId: supabaseUser.id };
}

/** Fase 3: gera o dossiê final em PDF a partir de uma checagem já rodada. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { id } = await params;

  const result = await generateAndStoreInvestorComplianceReportPdf(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json(result);
}

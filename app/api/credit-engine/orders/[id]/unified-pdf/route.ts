import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { gerarPdfUnificado } from "@/lib/credit-unified-pdf";

// Puppeteer (capa + eventuais dossiês defasados) pode levar dezenas de segundos por parte.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface RouteParams { params: Promise<{ id: string }> }

// POST /api/credit-engine/orders/[id]/unified-pdf — gera um PDF único com a capa-resumo, o dossiê
// da empresa e o de cada sócio/garantidor do pedido. Não altera o relatório entregue ao cliente
// (report_public_token / report_pdf_path do pedido): é um arquivo de uso da Mesa.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const r = await gerarPdfUnificado(db, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, ...r });
}

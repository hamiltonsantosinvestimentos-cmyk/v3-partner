import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { pedidoPeloId } from "@/lib/analise-estruturada/documentos";
import { calcularPedido, carregarCalculo } from "@/lib/analise-estruturada/calculo-pedido";

// Motor de cálculo da Análise Estruturada V3 pela Mesa (entrega 3).
//   GET  → último cálculo salvo
//   POST → recalcula com as leituras atuais (inclusive as corrigidas pela Mesa)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

interface RouteParams { params: Promise<{ orderId: string }> }

async function autorizado(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ROLES.includes(profile?.role ?? "")) return null;
  return profile?.full_name ?? user.email ?? "Mesa";
}

const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_req: Request, { params }: RouteParams) {
  if (!(await autorizado())) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { orderId } = await params;
  const db = svc();
  if (!(await pedidoPeloId(db, orderId))) return NextResponse.json({ calculo: null });
  return NextResponse.json({ calculo: await carregarCalculo(db, orderId) });
}

export async function POST(_req: Request, { params }: RouteParams) {
  const autor = await autorizado();
  if (!autor) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { orderId } = await params;
  const db = svc();
  const pedido = await pedidoPeloId(db, orderId);
  if (!pedido) return NextResponse.json({ error: "Pedido não é da Análise Estruturada." }, { status: 404 });
  return NextResponse.json({ calculo: await calcularPedido(db, pedido, autor) });
}

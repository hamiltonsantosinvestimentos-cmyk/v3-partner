import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { pedidoPeloId } from "@/lib/analise-estruturada/documentos";
import { lerArquivo, salvarRevisao, caminhoPertenceAoPedido } from "@/lib/analise-estruturada/extracao";

// Leitura dos documentos da Análise Estruturada V3 pela Mesa (entrega 2).
//   POST { caminho }        → lê um arquivo (OFX direto; PDF, imagem, planilha e Word pela IA)
//   PUT  { caminho, dados } → grava a correção da Mesa e refaz as checagens
// Um arquivo por chamada, para nunca bater no limite de tempo da função.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

interface RouteParams { params: Promise<{ orderId: string }> }

async function autorizado(): Promise<{ id: string; nome: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ROLES.includes(profile?.role ?? "")) return null;
  return { id: user.id, nome: profile?.full_name ?? user.email ?? "Mesa" };
}

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!(await autorizado())) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { orderId } = await params;
  const { caminho } = await req.json().catch(() => ({})) as { caminho?: string };
  const db = svc();
  const pedido = await pedidoPeloId(db, orderId);
  if (!pedido) return NextResponse.json({ error: "Pedido não é da Análise Estruturada." }, { status: 404 });
  if (!caminho || !caminhoPertenceAoPedido(orderId, caminho)) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });

  const resultado = await lerArquivo(db, pedido, caminho);
  return NextResponse.json({ resultado });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const usuario = await autorizado();
  if (!usuario) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { orderId } = await params;
  const { caminho, dados } = await req.json().catch(() => ({})) as { caminho?: string; dados?: Record<string, unknown> };
  if (!caminho || !caminhoPertenceAoPedido(orderId, caminho) || !dados || typeof dados !== "object") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const db = svc();
  if (!(await pedidoPeloId(db, orderId))) return NextResponse.json({ error: "Pedido não é da Análise Estruturada." }, { status: 404 });

  const resultado = await salvarRevisao(db, orderId, caminho, dados, usuario.nome);
  if (!resultado) return NextResponse.json({ error: "Leia o arquivo antes de corrigir." }, { status: 409 });
  return NextResponse.json({ resultado });
}

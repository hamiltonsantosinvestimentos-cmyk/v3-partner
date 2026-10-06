import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ehDaEquipe } from "@/lib/enterprise";
import { arquivosDaProposta, gerarRaioXExtrato, type RaioXExtratoSalvo } from "@/lib/raio-x-extrato";

// Raio-X de extrato na proposta (modal da Mesa de Crédito).
// GET: arquivos da proposta que podem ser extratos + último raio-X salvo.
// POST { ids: string[] }: lê os extratos escolhidos e gera o raio-X de custos.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MESA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function acesso(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const db = svc();
  const [{ data: profile }, { data: proposta }] = await Promise.all([
    db.from("profiles").select("full_name, role").eq("id", user.id).single(),
    db.from("credit_desk_proposals").select("id, partner_id, documents, metadata").eq("id", id).single(),
  ]);
  if (!proposta) return { erro: NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 }) };
  if (!MESA.includes(profile?.role ?? "") && !(await ehDaEquipe(user.id, proposta.partner_id))) {
    return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { db, proposta, autor: (profile?.full_name as string | null) ?? user.email ?? "usuário" };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await acesso(id);
  if ("erro" in a) return a.erro;
  const meta = (a.proposta.metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    arquivos: arquivosDaProposta(a.proposta).map(({ bucket: _b, ...x }) => x),
    raioX: (meta.raio_x_extrato as RaioXExtratoSalvo | undefined) ?? null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await acesso(id);
  if ("erro" in a) return a.erro;
  const body = await req.json().catch(() => ({})) as { ids?: string[] };
  const ids = new Set(Array.isArray(body.ids) ? body.ids : []);
  const escolhidos = arquivosDaProposta(a.proposta).filter((x) => ids.has(x.id)).slice(0, 12);
  if (!escolhidos.length) return NextResponse.json({ error: "Escolha pelo menos um extrato." }, { status: 400 });
  const raioX = await gerarRaioXExtrato(a.db, id, escolhidos, a.autor);
  return NextResponse.json({ raioX });
}

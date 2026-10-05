import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { pedidoPeloId, statusDocumentos } from "@/lib/analise-estruturada/documentos";
import { BUCKET_ANALISE } from "@/lib/analise-estruturada/checklist";
import { carregarResultado } from "@/lib/analise-estruturada/extracao";

// Documentos da Análise Estruturada V3 de um pedido, para a Mesa (Pedidos de Partners).
// O prefixo /api/analise-estruturada/ é público no proxy (por causa do envio do cliente),
// então a sessão e o papel são checados aqui.

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const VALIDADE_LINK_SEGUNDOS = 60 * 60;

interface RouteParams { params: Promise<{ orderId: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ROLES.includes(profile?.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { orderId } = await params;
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pedido = await pedidoPeloId(db, orderId);
  if (!pedido) return NextResponse.json({ ativo: false });

  const status = await statusDocumentos(db, pedido);
  const caminhos = status.itens.flatMap((i) => i.arquivos.map((a) => a.caminho));
  const { data: links } = caminhos.length
    ? await db.storage.from(BUCKET_ANALISE).createSignedUrls(caminhos, VALIDADE_LINK_SEGUNDOS)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorCaminho = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
  const leituras = new Map(await Promise.all(caminhos.map(async (c) => [c, await carregarResultado(db, orderId, c)] as const)));

  return NextResponse.json({
    ativo: true,
    perfil: status.perfil,
    completo: status.completo,
    completo_em: status.completoEm,
    prazo_entrega: status.prazoEntrega,
    obrigatorios_faltando: status.obrigatoriosFaltando,
    itens: status.itens.map((i) => ({
      key: i.key,
      label: i.label,
      obrigatorio: i.obrigatorio,
      arquivos: i.arquivos.map((a) => ({
        nome: a.nome, caminho: a.caminho, enviado_em: a.enviado_em, url: urlPorCaminho.get(a.caminho) ?? null,
        leitura: leituras.get(a.caminho) ?? null,
      })),
    })),
  });
}

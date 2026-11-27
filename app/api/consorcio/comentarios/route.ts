// Comentários e histórico dos itens do Kanban de Consórcio › Projetos.
// BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md
// Exceção aceita (go mesmo assim do Hamilton, 27/11/2026): recorte por papel nesta rota (service role),
// tabela fechada a anon e authenticated; amarrada à RLS por dono prometida para 05/12/2026.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { idsDaEquipe } from "@/lib/enterprise";
import { ehInterno } from "../vitrine";
import {
  LIMITE_POR_MINUTO, comentariosVisiveis, podeComentar, podeMover, podeNotaInterna, validarTexto, visibilidadeGravada,
  type AlvoTipo, type ViewerKanban,
} from "@/lib/consorcio/kanban";
import { avisar, donoEMaster, equipeQueMove, faltaNoBanco } from "@/lib/consorcio/kanban-db";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Item = { id: string; code: string; created_by: string | null };

async function contexto() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: p } = await db.from("profiles").select("full_name, role, enterprise_id").eq("id", user.id).maybeSingle();
  const perfil = p as { full_name: string | null; role: string | null; enterprise_id: string | null } | null;
  const interno = ehInterno(perfil?.role);
  const viewer: ViewerKanban = {
    id: user.id, papel: perfil?.role ?? null, interno,
    equipe: interno ? [] : await idsDaEquipe(db, { id: user.id, role: perfil?.role ?? null, enterprise_id: perfil?.enterprise_id ?? null }),
  };
  return { db, viewer };
}

/** Item visível ao viewer, ou null (inexistente, excluído ou sem acesso = 404, sem revelar existência). */
async function itemVisivel(db: SupabaseClient, viewer: ViewerKanban, tipo: AlvoTipo, id: string): Promise<Item | null> {
  if (tipo === "CONTRATACAO") {
    const { data } = await db.from("consorcio_contratacoes").select("id, code, created_by, deleted_at").eq("id", id).maybeSingle();
    const d = data as { id: string; code: string; created_by: string | null; deleted_at: string | null } | null;
    if (!d || d.deleted_at) return null;
    if (!viewer.interno && !(d.created_by && viewer.equipe.includes(d.created_by))) return null;
    return { id: d.id, code: `Pedido de cota ${d.code}`, created_by: d.created_by };
  }
  const { data } = await db.from("consorcio_ofertas").select("id, carta_code, created_by").eq("id", id).maybeSingle();
  const d = data as { id: string; carta_code: string | null; created_by: string | null } | null;
  if (!d) return null;
  if (!viewer.interno && !(d.created_by && viewer.equipe.includes(d.created_by))) return null;
  return { id: d.id, code: `Oferta da carta ${d.carta_code ?? ""}`.trim(), created_by: d.created_by };
}

function lerAlvo(tipo: unknown, id: unknown): { tipo: AlvoTipo; id: string } | null {
  if ((tipo !== "CONTRATACAO" && tipo !== "OFERTA") || typeof id !== "string" || !UUID.test(id)) return null;
  return { tipo, id };
}

export async function GET(req: NextRequest) {
  const ctx = await contexto();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const alvo = lerAlvo(req.nextUrl.searchParams.get("tipo"), req.nextUrl.searchParams.get("id"));
  const naoEncontrado = NextResponse.json({ error: "Item não encontrado." }, { status: 404, headers: NO_STORE });
  if (!alvo) return naoEncontrado;
  const { db, viewer } = ctx;
  const item = await itemVisivel(db, viewer, alvo.tipo, alvo.id);
  if (!item) return naoEncontrado;

  const { data, error } = await db.from("consorcio_comentarios")
    .select("id, autor_id, texto, visivel_partner, evento, created_at")
    .eq("alvo_tipo", alvo.tipo).eq("alvo_id", alvo.id)
    .order("created_at", { ascending: true }).limit(500);
  if (error) {
    if (faltaNoBanco(error)) return NextResponse.json({ comentarios: [], pode_comentar: false, pode_nota_interna: false, disponivel: false }, { headers: NO_STORE });
    console.error("[consorcio/comentarios GET]", error.code);
    return NextResponse.json({ error: "Não foi possível carregar os comentários agora." }, { status: 500, headers: NO_STORE });
  }
  const linhas = comentariosVisiveis(viewer, (data ?? []) as { id: string; autor_id: string; texto: string; visivel_partner: boolean; evento: boolean; created_at: string }[]);
  const autores = [...new Set(linhas.map((c) => c.autor_id))];
  const { data: perfis } = autores.length
    ? await db.from("profiles").select("id, full_name").in("id", autores)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nomes = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim() || "Usuário sem nome"]));

  return NextResponse.json({
    comentarios: linhas.map((c) => ({
      id: c.id, autor: nomes.get(c.autor_id) ?? "Usuário sem nome", texto: c.texto,
      visivel_partner: c.visivel_partner, evento: c.evento, created_at: c.created_at,
    })),
    pode_comentar: podeComentar(viewer, item),
    pode_nota_interna: podeNotaInterna(viewer),
    pode_mover: podeMover(viewer.papel),
    disponivel: true,
  }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const ctx = await contexto();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { tipo?: unknown; id?: unknown; texto?: unknown; visivel_partner?: unknown } | null;
  const alvo = lerAlvo(body?.tipo, body?.id);
  if (!alvo) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  const { db, viewer } = ctx;
  const item = await itemVisivel(db, viewer, alvo.tipo, alvo.id);
  if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  if (!podeComentar(viewer, item)) return NextResponse.json({ error: "Você pode ler, mas não comentar neste item." }, { status: 403 });
  const t = validarTexto(body?.texto);
  if (!t.ok) return NextResponse.json({ error: t.erro }, { status: 400 });

  // Limite contado no banco (memória da função não vale entre instâncias).
  const umMinuto = new Date(Date.now() - 60_000).toISOString();
  const { count, error: cErr } = await db.from("consorcio_comentarios")
    .select("id", { count: "exact", head: true }).eq("autor_id", viewer.id).eq("evento", false).gte("created_at", umMinuto);
  if (cErr && faltaNoBanco(cErr)) return NextResponse.json({ error: "Comentários indisponíveis no momento." }, { status: 503 });
  if ((count ?? 0) >= LIMITE_POR_MINUTO) return NextResponse.json({ error: "Muitos comentários seguidos. Espere um pouco." }, { status: 429 });

  const visivel = visibilidadeGravada(viewer, body?.visivel_partner);
  const { data: criado, error } = await db.from("consorcio_comentarios").insert({
    alvo_tipo: alvo.tipo, alvo_id: alvo.id, autor_id: viewer.id, texto: t.texto, visivel_partner: visivel, evento: false,
  }).select("id, created_at").single();
  if (error || !criado) {
    if (faltaNoBanco(error)) return NextResponse.json({ error: "Comentários indisponíveis no momento." }, { status: 503 });
    console.error("[consorcio/comentarios POST]", error?.code);
    return NextResponse.json({ error: "Não foi possível comentar agora. Tente de novo." }, { status: 500 });
  }

  // Avisos sem o texto: V3 visível → dono e master; partner → ADMIN e GESTAO. Nota interna não avisa ninguém.
  try {
    const link = alvo.tipo === "CONTRATACAO" ? "/consorcio/projetos#cotas-novas" : "/consorcio/projetos#ofertas";
    if (podeMover(viewer.papel)) {
      if (visivel) {
        const destinos = (await donoEMaster(db, item.created_by)).filter((x) => x !== viewer.id);
        await avisar(db, destinos, "Novo comentário da V3", `${item.code}: a V3 deixou um comentário.`, link);
      }
    } else {
      const destinos = (await equipeQueMove(db)).filter((x) => x !== viewer.id);
      await avisar(db, destinos, "Novo comentário do partner", `${item.code}: o partner respondeu.`, link);
    }
  } catch (e) {
    console.error("[consorcio/comentarios POST] avisos", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, id: (criado as { id: string }).id, visivel_partner: visivel });
}

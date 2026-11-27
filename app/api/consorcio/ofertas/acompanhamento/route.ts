// Acompanhamento das ofertas de cota contemplada (Consórcio › Projetos).
// BRIEF docs/briefs/2026-11-27_ofertas-cota-contemplada-em-projetos.md
// Exceção aceita (go mesmo assim do Hamilton, 27/11/2026): o recorte por papel fica nesta rota (service
// role), não na RLS. A RLS por dono de consorcio_ofertas está prometida até 05/12/2026; revisar esta rota.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { idsDaEquipe, marcasDosPartners } from "@/lib/enterprise";
import { ehInterno } from "../../vitrine";
import {
  COLUNAS_OFERTA, ofertaParaAcompanhamento, ordenarOfertas, origemDaOferta, podeVerOferta, type Viewer,
} from "@/lib/consorcio/ofertas-acompanhamento";

export const dynamic = "force-dynamic";

const LIMITE_DEMAIS = 300;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  try {
    const { data: perfil, error: perfilErr } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (perfilErr) throw new Error(perfilErr.message);
    const interno = ehInterno(perfil?.role as string | null);
    const viewer: Viewer = { id: user.id, interno, equipe: interno ? [] : await idsDaEquipe(svc, user.id) };

    // Todas as pendentes + as 300 mais recentes das demais: pendente antiga nunca some da lista.
    const base = () => {
      const q = svc.from("consorcio_ofertas").select(COLUNAS_OFERTA);
      return interno ? q : q.in("created_by", viewer.equipe);
    };
    const [pend, demais] = await Promise.all([
      base().eq("status", "pendente").order("created_at", { ascending: false }),
      base().neq("status", "pendente").order("created_at", { ascending: false }).limit(LIMITE_DEMAIS),
    ]);
    if (pend.error || demais.error) throw new Error((pend.error ?? demais.error)!.message);

    const linhas = ([...(pend.data ?? []), ...(demais.data ?? [])] as Record<string, unknown>[]).filter((o) => {
      const ok = podeVerOferta(viewer, o as { created_by?: string | null });
      if (!ok) console.error("[consorcio/ofertas/acompanhamento] linha recusada", { oferta: o.id, viewer: user.id });
      return ok;
    });

    const criadores = [...new Set(linhas.map((o) => o.created_by as string | null).filter((x): x is string => !!x))];
    const { data: perfis } = criadores.length
      ? await svc.from("profiles").select("id, full_name, role").in("id", criadores)
      : { data: [] as { id: string; full_name: string | null; role: string | null }[] };
    const porId = new Map(((perfis ?? []) as { id: string; full_name: string | null; role: string | null }[]).map((p) => [p.id, p]));
    const marcas = interno ? await marcasDosPartners(svc, criadores) : new Map();

    const ofertas = ordenarOfertas(linhas.map((o) => {
      const criador = porId.get(String(o.created_by ?? ""));
      const ofertadoPor = criador?.full_name?.trim() || "Usuário sem nome";
      return interno
        ? ofertaParaAcompanhamento(o, "interno", { ofertadoPor, origem: origemDaOferta(marcas, o.created_by as string | null, ehInterno(criador?.role)) })
        : ofertaParaAcompanhamento(o, "partner", { ofertadoPor });
    }));

    return NextResponse.json({ ofertas, interno });
  } catch (e) {
    console.error("[consorcio/ofertas/acompanhamento]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível carregar as ofertas agora." }, { status: 500 });
  }
}

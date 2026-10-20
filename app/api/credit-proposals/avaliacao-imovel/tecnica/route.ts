import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { atualizarMetadata } from "@/lib/credit-proposal-meta";
import { baixarArquivosDoImovel, gerarAvaliacaoTecnica, type DocEntry, type ItemChecklist, type LeituraGuardada } from "@/lib/avaliacao-tecnica/extrair";
import type { AvaliacaoTecnica, PadraoNivel, ZonaImovel } from "@/lib/avaliacao-tecnica/tipos";

// Avaliação Técnica V3 do imóvel em garantia (17/10/2026, pedido do Hamilton).
// POST inicia (leva ~2-3 min: lê matrícula/IPTU/CCIR/ITR/CAR/GEO/fotos, pesquisa o mercado
// na internet e escreve o parecer) e devolve na hora; o trabalho segue em segundo plano
// (after) e o modal acompanha pelo GET. Status em metadata.imoveis[i].avaliacao_tecnica_job,
// resultado em metadata.imoveis[i].avaliacao_tecnica — só o servidor grava os dois.

export const maxDuration = 300;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
/** Job "processando" há mais que isso morreu junto com a função (timeout). */
const JOB_EXPIRA_MS = 6 * 60 * 1000;

type Imovel = Record<string, unknown>;

async function autorizar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  return { user, nome: (profile?.full_name as string | null) ?? null };
}

const db = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function gravarNoImovel(proposalId: string, idx: number, legado: Imovel, alterar: (im: Imovel) => Imovel) {
  return atualizarMetadata(db(), proposalId, (meta) => {
    let imoveis = Array.isArray(meta.imoveis) ? [...(meta.imoveis as Imovel[])] : [];
    if (imoveis.length === 0) imoveis = [legado];
    while (imoveis.length <= idx) imoveis.push({});
    imoveis[idx] = alterar({ ...imoveis[idx] });
    return { ...meta, imoveis };
  });
}

export async function GET(req: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const id = req.nextUrl.searchParams.get("proposal_id");
  if (!id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });
  const { data } = await db().from("credit_desk_proposals").select("metadata").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  return NextResponse.json({ metadata: data.metadata ?? {} });
}

export async function POST(req: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { proposal_id?: string; imovel_idx?: number; itens?: ItemChecklist[]; nova_pesquisa?: boolean; reler_documentos?: boolean };
  const idx = Number(body.imovel_idx ?? 0);
  if (!body.proposal_id || !Number.isInteger(idx) || idx < 0) return NextResponse.json({ error: "proposal_id e imovel_idx obrigatórios" }, { status: 400 });
  const itens = (Array.isArray(body.itens) ? body.itens : []).filter((i) => i && typeof i.doc_id === "string").map((i) => ({ doc_id: i.doc_id, label: String(i.label ?? "") }));

  const { data: proposal } = await db()
    .from("credit_desk_proposals")
    .select("id, client_name, requested_value, documents, metadata, imovel_endereco, imovel_cidade, imovel_estado")
    .eq("id", body.proposal_id)
    .single();
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const meta = (proposal.metadata ?? {}) as Record<string, unknown>;
  const legado: Imovel = { endereco: proposal.imovel_endereco ?? undefined, cidade: proposal.imovel_cidade ?? undefined, estado: proposal.imovel_estado ?? undefined };
  const lista = Array.isArray(meta.imoveis) && (meta.imoveis as Imovel[]).length > 0 ? (meta.imoveis as Imovel[]) : [legado];
  const im = (lista[idx] ?? {}) as Imovel;
  const job = im.avaliacao_tecnica_job as { status?: string; iniciado_em?: string } | undefined;
  if (job?.status === "PROCESSANDO" && job.iniciado_em && Date.now() - new Date(job.iniciado_em).getTime() < JOB_EXPIRA_MS) {
    return NextResponse.json({ error: "A avaliação deste imóvel já está em andamento." }, { status: 409 });
  }

  // Zona: a do imóvel; senão a resposta "Possui imóvel em garantia?" da proposta.
  const zona: ZonaImovel = im.zona === "RURAL" || im.zona === "URBANO"
    ? (im.zona as ZonaImovel)
    : meta.imovel_garantia === "rural" ? "RURAL" : "URBANO";

  const documentos = (Array.isArray(proposal.documents) ? proposal.documents : []) as DocEntry[];
  // Reavaliar reaproveita a pesquisa de mercado da avaliação anterior (até 30 dias, mesma zona):
  // o valor só muda se os documentos mudarem. "Nova pesquisa de mercado" busca anúncios de novo.
  const anterior = im.avaliacao_tecnica as AvaliacaoTecnica | undefined;
  const diasAnterior = anterior?.gerado_em ? (Date.now() - new Date(anterior.gerado_em).getTime()) / 86400000 : Infinity;
  const mercadoAnterior = !body.nova_pesquisa && anterior?.versao === 2 && anterior.zona === zona && diasAnterior <= 30 && anterior.mercado?.comparaveis?.length
    ? { ...anterior.mercado, observacoes: [anterior.mercado.observacoes, `Pesquisa reaproveitada da avaliação de ${new Date(anterior.gerado_em).toLocaleDateString("pt-BR")}.`].filter(Boolean).join(" ") }
    : null;
  const iniciado = { status: "PROCESSANDO", iniciado_em: new Date().toISOString(), iniciado_por: a.nome, etapa: "Lendo os documentos" };
  const marcado = await gravarNoImovel(proposal.id, idx, legado, (x) => ({ ...x, avaliacao_tecnica_job: iniciado }));
  if (!marcado.ok) return NextResponse.json({ error: marcado.error }, { status: 500 });

  after(async () => {
    try {
      const { baixados, ignorados } = await baixarArquivosDoImovel(db(), documentos, itens);
      if (baixados.length === 0) throw new Error("Nenhum documento do imóvel encontrado (matrícula, IPTU, CCIR, ITR, CAR, GEO, fotos ou laudo).");
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const av = await gerarAvaliacaoTecnica({
        ai: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        arquivos: baixados,
        contexto: {
          zona,
          cliente_nome: proposal.client_name,
          endereco: (im.endereco as string) ?? null,
          cidade: (im.cidade as string) ?? null,
          estado: (im.estado as string) ?? null,
          cep: (im.cep as string) ?? null,
          area_m2: typeof im.area_m2 === "number" ? im.area_m2 : null,
          outros_imoveis: lista.length - 1,
        },
        valorSolicitado: Number(proposal.requested_value) || null,
        mercadoAnterior,
        // Leitura dos documentos guardada: reaproveitada se os arquivos forem os mesmos.
        leituraGuardada: body.reler_documentos ? null : ((im.avaliacao_leitura as LeituraGuardada | undefined) ?? null),
        onLeitura: (g) => gravarNoImovel(proposal.id, idx, legado, (x) => ({ ...x, avaliacao_leitura: g })),
        padraoFotos: ((im.padrao_manual ?? (im.padrao_construtivo as { padrao?: string } | undefined)?.padrao) as PadraoNivel | undefined) ?? null,
        geradoPor: a.nome,
        onEtapa: (etapa) => gravarNoImovel(proposal.id, idx, legado, (x) => ({ ...x, avaliacao_tecnica_job: { ...iniciado, etapa } })),
      });
      const id = av.identificacao;
      await gravarNoImovel(proposal.id, idx, legado, (x) => ({
        ...x,
        // Completa o que o imóvel ainda não tinha (não sobrescreve o que a Mesa digitou).
        endereco: x.endereco || id.endereco || undefined,
        cidade: x.cidade || id.cidade || undefined,
        estado: x.estado || id.uf || undefined,
        cep: x.cep || id.cep || undefined,
        proprietario: x.proprietario || (id.proprietarios ?? []).join(", ") || undefined,
        area_m2: x.area_m2 || (av.zona === "URBANO" ? av.valores.area_considerada ?? undefined : undefined),
        avaliacao_tecnica: av,
        avaliacao_tecnica_job: { status: "CONCLUIDO", iniciado_em: iniciado.iniciado_em, concluido_em: new Date().toISOString(), ignorados },
      }));
    } catch (e) {
      console.error("[avaliacao-tecnica]", e);
      await gravarNoImovel(proposal.id, idx, legado, (x) => ({
        ...x,
        avaliacao_tecnica_job: { status: "ERRO", iniciado_em: iniciado.iniciado_em, erro: (e as Error).message || "Erro na avaliação" },
      }));
    }
  });

  return NextResponse.json({ ok: true, metadata: marcado.metadata }, { status: 202 });
}

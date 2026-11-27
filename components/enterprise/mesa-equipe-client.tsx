"use client";

// Mesa Operacional do master Enterprise: Kanban das operações da equipe.
// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md (Kanban, cards mascarados)
// BRIEF docs/briefs/2026-11-27_mesa-operacional-master-modal-mesa-credito.md (clique abre a janela da
// Mesa de Crédito, com as mesmas props de partner de N1/N2/N3: não move etapa, não aprova, não gera contrato).
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, Loader2, Search, User } from "lucide-react";
import { PropostaDetailModal, type ProposalFull } from "@/components/mesa-credito/proposta-detail-modal";
import type { CardMesa } from "@/lib/enterprise/mesa-equipe";
import {
  COLUNAS, dataBR, LIMITE_MESA, propostaDaMesaDeCredito, resumoDaMesa, ROTULO_COLUNA, valorBR,
} from "@/app/(platform)/enterprise/mesa-operacional/exibicao";

interface Props {
  cards: CardMesa[];
  usuarios: { id: string; rotulo: string }[];
  originadorId: Record<string, string>;
  limiteAtingido: boolean;
}

type Proposta = ReturnType<typeof propostaDaMesaDeCredito>;

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function MesaEquipeClient({ cards, usuarios, originadorId, limiteAtingido }: Props) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("todos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<Proposta | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef<AbortController | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return cards
      .filter((c) => usuario === "todos" || originadorId[c.id] === usuario)
      .filter((c) => !q || normalizar(c.cliente.nome).includes(q) || normalizar(c.codigo).includes(q))
      .sort((a, b) => String(b.atualizado_em ?? "").localeCompare(String(a.atualizado_em ?? "")));
  }, [cards, usuario, busca, originadorId]);

  const resumo = useMemo(() => resumoDaMesa(filtrados), [filtrados]);
  const temFiltro = usuario !== "todos" || busca.trim() !== "";

  // Mesma rota e mesmo recorte por papel que a Mesa de Crédito usa. A janela nunca abre com dado parcial.
  const abrir = useCallback(async (id: string) => {
    pedido.current?.abort();
    const ctrl = new AbortController();
    pedido.current = ctrl;
    setErro(null);
    setAbrindo(id);
    try {
      const res = await fetch(`/api/credit-proposals?id=${encodeURIComponent(id)}`, { signal: ctrl.signal });
      if (res.status === 404) { setErro("Esta proposta não está mais disponível."); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.proposal) { setErro("Não foi possível abrir a proposta agora. Tente de novo."); return; }
      if (!ctrl.signal.aborted) setAberta(propostaDaMesaDeCredito(json.proposal as Record<string, unknown>));
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") setErro("Não foi possível abrir a proposta agora. Tente de novo.");
    } finally {
      if (pedido.current === ctrl) { pedido.current = null; setAbrindo(null); }
    }
  }, []);

  // Igual ao handleProposalUpdate de nivel1-client: a janela recebe por aqui o que o servidor gravou.
  const aoAtualizar = useCallback((proposalId: string, updates: Partial<ProposalFull>) => {
    setAberta((prev) => (prev && prev.id === proposalId ? { ...prev, ...(updates as Partial<Proposta>) } : prev));
  }, []);

  // Várias ações da janela gravam sem avisar o pai (remover documento, checklist, chat): atualiza sempre ao fechar.
  const fechar = useCallback(() => {
    setAberta(null);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[#F0ECE4]">Mesa Operacional</h1>
        <p className="text-sm text-[#7A8FA8] mt-1">
          Operações da sua equipe, em tempo real. As etapas são movidas pela mesa de análise.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Resumo rotulo="Operações ativas" valor={String(resumo.ativas)} />
        <Resumo rotulo="Valor solicitado (ativas)" valor={valorBR(resumo.valorSolicitadoAtivas)} />
        <Resumo rotulo="Encerradas" valor={String(resumo.encerradas)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex flex-col gap-1 text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">
          Usuário
          <select
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="h-9 rounded-lg bg-[#111F35] border border-[#162744] px-3 text-sm normal-case tracking-normal font-normal text-[#F0ECE4]"
          >
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.rotulo}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1 text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">
          Buscar
          <span className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente ou código"
              className="h-9 w-full rounded-lg bg-[#111F35] border border-[#162744] pl-9 pr-3 text-sm normal-case tracking-normal font-normal text-[#F0ECE4] placeholder:text-[#7A8FA8]"
            />
          </span>
        </label>
      </div>

      {limiteAtingido && <p className="text-xs text-[#7A8FA8]">Mostrando as {LIMITE_MESA} operações mais recentes.</p>}

      {erro && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-[#C9A84C]/35 bg-[#C9A84C]/10 px-4 py-2.5 text-sm text-[#E8C97A]">
          <span>{erro}</span>
          <button type="button" onClick={() => setErro(null)} className="text-xs underline">Fechar</button>
        </div>
      )}

      {cards.length === 0 ? (
        <Vazio texto="Nenhuma operação da equipe ainda. As propostas criadas por você e pelos usuários da sua equipe aparecem aqui." />
      ) : filtrados.length === 0 && temFiltro ? (
        <Vazio texto="Nenhuma operação encontrada com esse filtro." />
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {COLUNAS.map((col) => {
              const lista = filtrados.filter((c) => c.coluna === col);
              return (
                <section key={col} className="w-64 shrink-0 rounded-xl bg-[#111F35] border border-[#162744] p-2">
                  <header className="flex items-center justify-between px-1 py-1.5">
                    <h2 className="text-xs font-semibold text-[#F0ECE4]">{ROTULO_COLUNA[col]}</h2>
                    <span className="text-[10px] font-bold text-[#C9A84C]">{resumo.porColuna[col]}</span>
                  </header>
                  <div className="space-y-2 mt-1">
                    {lista.length === 0 ? (
                      <p className="text-[11px] text-[#7A8FA8] px-1 py-3">Nenhuma operação nesta etapa</p>
                    ) : lista.map((c) => (
                      <Card key={c.id} c={c} abrindo={abrindo === c.id} bloqueado={abrindo !== null} onAbrir={() => abrir(c.id)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <PropostaDetailModal
        open={!!aberta}
        onClose={fechar}
        proposal={aberta as ProposalFull | null}
        onStageChange={() => {}}
        onProposalUpdate={aoAtualizar}
        canChangeStage={false}
        canEditValorSolicitado={false}
        canEditInstituicao={false}
        canGenerateContract={false}
        isAdmin={false}
      />
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-[#162744] border border-[#243A66] px-4 py-3">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">{rotulo}</p>
      <p className="text-lg font-semibold text-[#F0ECE4] mt-1">{valor}</p>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#243A66] p-10 text-center text-sm text-[#7A8FA8]">{texto}</div>
  );
}

function docsEnviados(c: CardMesa) {
  const total = c.documentos_recebidos.length + c.documentos_pendentes.length;
  return `${c.documentos_recebidos.length} de ${total} enviados`;
}

function Card({ c, abrindo, bloqueado, onAbrir }: { c: CardMesa; abrindo: boolean; bloqueado: boolean; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      disabled={bloqueado}
      aria-busy={abrindo}
      className="w-full text-left rounded-lg bg-[#162744] border border-[#243A66] hover:border-[#C9A84C]/50 p-3 space-y-1.5 transition-colors disabled:cursor-wait disabled:opacity-70"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#C9A84C]">{c.codigo}</span>
        {abrindo ? (
          <span className="flex items-center gap-1 text-[10px] text-[#7A8FA8]"><Loader2 className="w-3 h-3 animate-spin" /> Abrindo…</span>
        ) : c.pendencia && (
          <span className="flex items-center gap-1 rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[9px] font-bold uppercase text-[#E8C97A]">
            <AlertCircle className="w-3 h-3" /> Pendência
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-[#F0ECE4] break-words">{c.cliente.nome || "Cliente sem nome"}</p>
      <p className="text-[11px] text-[#7A8FA8]">{c.cliente.cpf_cnpj ?? "Não informado"}</p>
      <p className="text-[11px] text-[#7A8FA8] break-words">{c.linha}</p>
      <p className="text-xs text-[#F0ECE4]">{valorBR(c.valor_solicitado)}</p>
      {c.valor_aprovado != null && <p className="text-[11px] text-[#E8C97A]">Aprovado: {valorBR(c.valor_aprovado)}</p>}
      <p className="flex items-center gap-1 text-[11px] text-[#7A8FA8]"><User className="w-3 h-3" /> {c.originador}</p>
      <p className="flex items-center gap-1 text-[11px] text-[#7A8FA8]"><FileText className="w-3 h-3" /> {docsEnviados(c)}</p>
      <p className="text-[10px] text-[#7A8FA8]">Atualizado em {dataBR(c.atualizado_em)}</p>
    </button>
  );
}

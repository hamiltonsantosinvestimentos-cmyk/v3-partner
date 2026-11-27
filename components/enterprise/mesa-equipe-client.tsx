"use client";

// Mesa Operacional do master Enterprise: Kanban só de leitura das operações da equipe.
// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md
// Nada aqui move, aprova, comenta ou envia. Documentos aparecem sem link para baixar.
import { useMemo, useState } from "react";
import { AlertCircle, FileText, Search, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CardMesa } from "@/lib/enterprise/mesa-equipe";
import {
  COLUNAS, dataBR, LIMITE_MESA, resumoDaMesa, ROTULO_COLUNA, valorBR,
} from "@/app/(platform)/enterprise/mesa-operacional/exibicao";

interface Props {
  cards: CardMesa[];
  usuarios: { id: string; rotulo: string }[];
  originadorId: Record<string, string>;
  limiteAtingido: boolean;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function MesaEquipeClient({ cards, usuarios, originadorId, limiteAtingido }: Props) {
  const [usuario, setUsuario] = useState("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<CardMesa | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return cards
      .filter((c) => usuario === "todos" || originadorId[c.id] === usuario)
      .filter((c) => !q || normalizar(c.cliente.nome).includes(q) || normalizar(c.codigo).includes(q))
      .sort((a, b) => String(b.atualizado_em ?? "").localeCompare(String(a.atualizado_em ?? "")));
  }, [cards, usuario, busca, originadorId]);

  const resumo = useMemo(() => resumoDaMesa(filtrados), [filtrados]);
  const temFiltro = usuario !== "todos" || busca.trim() !== "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[#F0ECE4]">Mesa Operacional</h1>
        <p className="text-sm text-[#7A8FA8] mt-1">
          Operações da sua equipe, em tempo real. Só acompanhamento: a análise é feita pela mesa.
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
                    ) : lista.map((c) => <Card key={c.id} c={c} onAbrir={() => setAberto(c)} />)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!aberto} onOpenChange={(o) => { if (!o) setAberto(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {aberto && <Detalhe c={aberto} />}
        </DialogContent>
      </Dialog>
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

function Card({ c, onAbrir }: { c: CardMesa; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full text-left rounded-lg bg-[#162744] border border-[#243A66] hover:border-[#C9A84C]/50 p-3 space-y-1.5 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#C9A84C]">{c.codigo}</span>
        {c.pendencia && (
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

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[#7A8FA8]">{rotulo}</span>
      <span className="text-[#F0ECE4] text-right break-words">{valor}</span>
    </div>
  );
}

function Detalhe({ c }: { c: CardMesa }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{c.codigo} · {c.cliente.nome || "Cliente sem nome"}</DialogTitle>
        <DialogDescription>{ROTULO_COLUNA[c.coluna]} · só acompanhamento</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Linha rotulo="CPF/CNPJ" valor={c.cliente.cpf_cnpj ?? "Não informado"} />
          <Linha rotulo="Linha" valor={c.linha || "Não informado"} />
          <Linha rotulo="Valor solicitado" valor={valorBR(c.valor_solicitado)} />
          {c.valor_aprovado != null && <Linha rotulo="Valor aprovado" valor={valorBR(c.valor_aprovado)} />}
          <Linha rotulo="Prazo" valor={c.prazo ? `${c.prazo} meses` : "Não informado"} />
          <Linha rotulo="Finalidade" valor={c.finalidade || "Não informado"} />
          <Linha rotulo="Usuário" valor={c.originador} />
          <Linha rotulo="Documentos" valor={docsEnviados(c)} />
          <Linha rotulo="Criada em" valor={dataBR(c.criada_em)} />
          <Linha rotulo="Atualizada em" valor={dataBR(c.atualizado_em)} />
        </div>

        {c.pendencia && (
          <Bloco titulo="Pendência aberta">
            <p className="text-sm text-[#F0ECE4] whitespace-pre-wrap">{c.pendencia.motivo}</p>
            <p className="text-[11px] text-[#7A8FA8] mt-1">
              Responsável: {c.pendencia.responsavel ?? "Não informado"} · desde {dataBR(c.pendencia.desde, true)}
            </p>
          </Bloco>
        )}

        {c.pendencias_documentos.length > 0 && (
          <Bloco titulo="Pendências de documentos">
            <ul className="space-y-1.5">
              {c.pendencias_documentos.map((p, i) => (
                <li key={i} className="text-sm text-[#F0ECE4]">
                  {p.documento}: {p.motivo || "Não informado"}
                  <span className="block text-[11px] text-[#7A8FA8]">desde {dataBR(p.desde, true)}</span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}

        <Bloco titulo="Documentos recebidos">
          {c.documentos_recebidos.length === 0 ? (
            <p className="text-sm text-[#7A8FA8]">Nenhum documento recebido.</p>
          ) : (
            <ul className="space-y-1.5">
              {c.documentos_recebidos.map((d, i) => (
                <li key={i} className="text-sm text-[#F0ECE4]">
                  {d.tipo_documento}
                  <span className="block text-[11px] text-[#7A8FA8] break-all">
                    {d.nome_arquivo || "Arquivo sem nome"} · {dataBR(d.recebido_em, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Documentos que faltam">
          {c.documentos_pendentes.length === 0 ? (
            <p className="text-sm text-[#7A8FA8]">Nenhum documento obrigatório faltando.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {c.documentos_pendentes.map((d, i) => <li key={i} className="text-sm text-[#F0ECE4]">{d}</li>)}
            </ul>
          )}
        </Bloco>

        <p className="text-[11px] text-[#7A8FA8] border-t border-[#243A66] pt-3">
          Para tratar uma pendência, o usuário responsável abre a proposta na Mesa de Crédito.
        </p>
      </div>
    </>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C] mb-1.5">{titulo}</p>
      {children}
    </div>
  );
}

"use client";

// Transferir de esteira (BRIEF Mesa M&A bloco C, 30/10/2026, revisão 3.4).
// Painel do deal: botão "Transferir para outra mesa", selos dos registros de destino e
// "Confirmar classificação". Os dois modais são vermelhos (ação com efeito em outra mesa e ação
// irreversível), explicam o impacto real, e só fecham pelos botões: clique fora e Esc não fecham.
// Nada é gravado antes de Confirmar; o servidor revalida tudo (rotas /api/ma/...).

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Dica } from "@/components/shared/dica";
import type { TransferenciaMesa } from "@/lib/ma/transferir-mesa-tipos";

const MOTIVO_MIN = 20;

const DESTINOS = [
  { value: "bolsa", label: "Bolsa de Ativos" },
  { value: "credito", label: "Mesa de Crédito" },
] as const;

// Tipos do ativo da Bolsa em ordem alfabética pt-BR pelo rótulo.
const TIPOS_ATIVO: { value: string; label: string }[] = [
  { value: "cgi", label: "CGI" },
  { value: "cri", label: "CRI" },
  { value: "direito_creditorio", label: "Direito creditório" },
  { value: "fidc", label: "FIDC" },
  { value: "icms", label: "ICMS" },
  { value: "imovel", label: "Imóvel" },
  { value: "ipi", label: "IPI" },
  { value: "outros", label: "Outros" },
  { value: "precatorio", label: "Precatório" },
];

const DESTINO_LABEL: Record<string, string> = { bolsa: "Bolsa de Ativos", credito: "Mesa de Crédito" };
const DESTINO_HREF: Record<string, string> = { bolsa: "/bolsa", credito: "/mesa-credito" };

const inputCls = "w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-sm px-3 py-2.5 placeholder:text-[#9BAFC5]/60 focus:outline-none focus:border-[#C9A84C] transition-colors";
const labelCls = "flex items-center gap-1.5 text-[11px] font-semibold text-[#9BAFC5] mb-1.5";

// DD/MM/AAAA sem passar por new Date("AAAA-MM-DD"), para a data não andar um dia.
function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

async function chamar(url: string, corpo: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; erro: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, erro: (json.error as string) ?? "Não foi possível concluir a operação." };
    return { ok: true, data: json };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." };
  }
}

type Cliente = { v3_client_id: string; nome: string };

export function TransferirMesaPainel({
  dealId, dealLabel, setorTexto, transferencias, onChanged,
}: {
  dealId: string;
  dealLabel: string;
  setorTexto: string;
  transferencias: TransferenciaMesa[];
  onChanged: () => void;
}) {
  const [aberto, setAberto] = useState<"transferir" | { classificar: TransferenciaMesa } | null>(null);

  return (
    <div className="pt-1 border-t border-[#122036] space-y-2">
      {transferencias.map((t) => (
        <Selo key={t.registro_id} t={t} onClassificar={() => setAberto({ classificar: t })} />
      ))}
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => setAberto("transferir")}
          className="text-xs text-[#9BAFC5] hover:text-[#C9A84C] transition-colors py-1.5 flex items-center justify-center gap-1.5"
        >
          <ArrowLeftRight size={12} /> Transferir para outra mesa
        </button>
        <Dica id="ma_transferir_motivo" />
      </div>

      {aberto === "transferir" && (
        <ModalTransferir
          dealId={dealId}
          dealLabel={dealLabel}
          onCancel={() => setAberto(null)}
          onDone={() => { setAberto(null); onChanged(); }}
        />
      )}
      {typeof aberto === "object" && aberto && (
        <ModalClassificar
          alvo={aberto.classificar}
          dealLabel={dealLabel}
          setorTexto={setorTexto}
          onCancel={() => setAberto(null)}
          onDone={() => { setAberto(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function Selo({ t, onClassificar }: { t: TransferenciaMesa; onClassificar: () => void }) {
  const destino = DESTINO_LABEL[t.destino] ?? t.destino;
  if (t.cancelado) {
    return (
      <p className="text-[11px] text-[#9BAFC5] rounded-lg border border-[#243A66] px-2.5 py-1.5">
        Transferência cancelada ({destino}, criada em {dataBr(t.criado_em)}). Pode transferir de novo.
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 px-2.5 py-1.5">
      <a href={DESTINO_HREF[t.destino] ?? "#"} className="text-[11px] font-semibold text-[#C9A84C] hover:underline min-w-0">
        Transferido: {destino}, {t.codigo ? t.codigo : "código a emitir"}
        <span className="font-normal text-[#9BAFC5]"> · {dataBr(t.criado_em)}</span>
      </a>
      {!t.codigo && (
        <span className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onClassificar}
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border border-[#C9A84C]/50 text-[#C9A84C] hover:bg-[#C9A84C]/10"
          >
            Confirmar classificação
          </button>
          <Dica id="ma_confirmar_classificacao" />
        </span>
      )}
    </div>
  );
}

// Montado só enquanto aberto: o estado nasce limpo a cada abertura, sem reset dentro de efeito.
function ModalTransferir({
  dealId, dealLabel, onCancel, onDone,
}: { dealId: string; dealLabel: string; onCancel: () => void; onDone: () => void }) {
  const [destino, setDestino] = useState("");
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ma/deals/${dealId}/clientes`)
      .then((r) => r.json())
      .then((j: { clientes?: { v3_client_id?: string; v3_clients?: { id: string; legal_name: string | null } | null }[] }) => {
        const lista = (j.clientes ?? [])
          .map((c) => ({ v3_client_id: c.v3_clients?.id ?? c.v3_client_id ?? "", nome: c.v3_clients?.legal_name ?? "Cliente sem nome" }))
          .filter((c) => c.v3_client_id)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setClientes(lista);
        if (lista.length === 1) setClienteId(lista[0].v3_client_id);
      })
      .catch(() => setClientes([]));
  }, [dealId]);

  const semCliente = clientes !== null && clientes.length === 0;
  const precisaEscolher = (clientes?.length ?? 0) > 1;
  const motivoOk = motivo.trim().length >= MOTIVO_MIN;
  const justOk = !semCliente || justificativa.trim().length >= MOTIVO_MIN;
  const clienteOk = !precisaEscolher || !!clienteId;
  const podeConfirmar = !salvando && clientes !== null && !!destino && motivoOk && justOk && clienteOk;

  async function confirmar() {
    if (!podeConfirmar) return;
    setSalvando(true); setErro(null);
    const r = await chamar(`/api/ma/deals/${dealId}/transferir-mesa`, {
      destino,
      motivo: motivo.trim(),
      justificativa_sem_parte: justificativa.trim() || undefined,
      v3_client_id: clienteId || undefined,
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onDone();
  }

  return (
    <Dialog open>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md w-[calc(100vw-32px)] max-h-[90vh] overflow-y-auto border border-[#F26D6D]/50 [&>button.absolute]:hidden"
      >
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F5F1E8]">
          <AlertTriangle className="w-4 h-4 text-[#F26D6D] flex-shrink-0" aria-hidden="true" />
          Transferir para outra mesa
        </DialogTitle>
        <p className="text-xs text-[#9BAFC5] -mt-2">{dealLabel}</p>

        <div className="rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/5 px-3 py-2.5 text-[12px] leading-relaxed text-[#F5F1E8]">
          Cria um registro na mesa de destino, <strong>não altera o acesso à pasta do deal</strong> e gera um aviso genérico ao partner originador.
          O deal continua na Mesa M&amp;A, na mesma fase. O registro nasce sem código: o código sai quando a mesa de destino confirmar a classificação.
        </div>

        <div>
          <label htmlFor="tm-destino" className={labelCls}>Mesa de destino</label>
          <select id="tm-destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls}>
            <option value="">Selecione</option>
            {DESTINOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {precisaEscolher && (
          <div>
            <label htmlFor="tm-cliente" className={labelCls}>Cliente (o deal tem mais de uma parte vinculada)</label>
            <select id="tm-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {clientes!.map((c) => <option key={c.v3_client_id} value={c.v3_client_id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="tm-motivo" className={labelCls}>Motivo <Dica id="ma_transferir_motivo" /></label>
          <textarea
            id="tm-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={`Mínimo de ${MOTIVO_MIN} caracteres. Não inclua dado pessoal: o texto fica na auditoria e no registro da mesa de destino.`}
            className={`${inputCls} resize-none`}
          />
          <p className="text-[10px] text-[#9BAFC5] mt-1">{motivo.trim().length}/{MOTIVO_MIN} caracteres no mínimo</p>
        </div>

        <div>
          <label htmlFor="tm-just" className={labelCls}>
            {semCliente ? "Justificativa (obrigatória: sem cliente vinculado)" : "Justificativa (só se a qualificação do cliente estiver pendente)"}
            <Dica id="ma_transferir_justificativa" />
          </label>
          <textarea
            id="tm-just" rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
            placeholder={semCliente ? `Mínimo de ${MOTIVO_MIN} caracteres` : "Deixe em branco se o cliente já está qualificado"}
            className={`${inputCls} resize-none`}
          />
          {semCliente && <p className="text-[10px] text-[#9BAFC5] mt-1">{justificativa.trim().length}/{MOTIVO_MIN} caracteres no mínimo</p>}
        </div>

        {erro && <p role="alert" className="rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/10 px-3 py-2 text-[12px] text-[#F5F1E8]">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} disabled={salvando}
            className="rounded-lg border border-[#243A66] px-4 py-2 text-xs font-semibold text-[#9BAFC5] hover:text-[#F5F1E8] disabled:opacity-40">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={!podeConfirmar}
            className="flex items-center gap-1.5 rounded-lg border border-[#F26D6D]/60 bg-[#F26D6D]/15 px-4 py-2 text-xs font-bold text-[#F26D6D] hover:bg-[#F26D6D]/25 disabled:opacity-40 disabled:cursor-not-allowed">
            {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar transferência
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Montado só enquanto aberto: o estado nasce limpo a cada abertura, sem reset dentro de efeito.
function ModalClassificar({
  alvo, dealLabel, setorTexto, onCancel, onDone,
}: { alvo: TransferenciaMesa; dealLabel: string; setorTexto: string; onCancel: () => void; onDone: () => void }) {
  const [setores, setSetores] = useState<{ code: string; label: string }[]>([]);
  const [setor, setSetor] = useState("");
  const [tipo, setTipo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  useEffect(() => {
    fetch("/api/ma/setores")
      .then((r) => r.json())
      .then((j: { setores?: { code: string; label: string }[] }) => setSetores(j.setores ?? []))
      .catch(() => setSetores([]));
  }, []);

  // Sugestão a partir do texto livre do deal; a escolha continua sendo consciente do operador.
  const sugestao = useMemo(() => {
    const alvoTexto = norm(setorTexto);
    if (!alvoTexto) return "";
    return setores.find((s) => norm(s.label) === alvoTexto || s.code.toLowerCase() === alvoTexto)?.code ?? "";
  }, [setores, setorTexto]);

  const ehBolsa = alvo.destino === "bolsa";
  const podeConfirmar = !salvando && !codigo && !!setor && (!ehBolsa || !!tipo);

  async function confirmar() {
    if (!podeConfirmar) return;
    setSalvando(true); setErro(null);
    const r = await chamar(`/api/ma/destino/${alvo.registro_id}/confirmar-classificacao`, {
      destino: alvo.destino, setor, asset_type: ehBolsa ? tipo : undefined,
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setCodigo(String(r.data.codigo ?? ""));
  }

  return (
    <Dialog open>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md w-[calc(100vw-32px)] max-h-[90vh] overflow-y-auto border border-[#F26D6D]/50 [&>button.absolute]:hidden"
      >
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F5F1E8]">
          <AlertTriangle className="w-4 h-4 text-[#F26D6D] flex-shrink-0" aria-hidden="true" />
          Confirmar a classificação
        </DialogTitle>
        <p className="text-xs text-[#9BAFC5] -mt-2">{dealLabel} · {DESTINO_LABEL[alvo.destino]}</p>

        {codigo ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-[13px] text-[#F5F1E8] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>Código emitido: <strong className="text-[#C9A84C]">{codigo}</strong></span>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/5 px-3 py-2.5 text-[12px] leading-relaxed text-[#F5F1E8]">
              Ao confirmar, o código {ehBolsa ? "BA" : "CR"} é emitido e <strong>consome um número da série</strong>, o card do deal passa a mostrar o código e o partner originador recebe um aviso de movimentação.
              Não dá para desfazer: se a classificação estiver errada, a mesa cancela o registro e o número fica aposentado.
            </div>

            <div>
              <label htmlFor="cc-setor" className={labelCls}>
                Setor do código <Dica id="ma_confirmar_classificacao" />
              </label>
              <select id="cc-setor" value={setor} onChange={(e) => setSetor(e.target.value)} className={inputCls}>
                <option value="">Selecione</option>
                {setores.map((s) => <option key={s.code} value={s.code}>{s.label} ({s.code})</option>)}
              </select>
              <p className="text-[10px] text-[#9BAFC5] mt-1">
                Setor informado no deal: {setorTexto || "não informado"}.
                {sugestao ? (
                  <> Sugestão: <button type="button" className="underline text-[#C9A84C]" onClick={() => setSetor(sugestao)}>usar {sugestao}</button>.</>
                ) : (
                  " Sem correspondência exata no dicionário: escolha o setor conscientemente (GRL vale para cross-vertical)."
                )}
              </p>
            </div>

            {ehBolsa && (
              <div>
                <label htmlFor="cc-tipo" className={labelCls}>Tipo do ativo</label>
                <select id="cc-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                  <option value="">Selecione</option>
                  {TIPOS_ATIVO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}

            {erro && <p role="alert" className="rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/10 px-3 py-2 text-[12px] text-[#F5F1E8]">{erro}</p>}
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {codigo ? (
            <button type="button" onClick={onDone}
              className="rounded-lg border border-[#C9A84C]/60 bg-[#C9A84C]/15 px-4 py-2 text-xs font-bold text-[#C9A84C] hover:bg-[#C9A84C]/25">
              Fechar
            </button>
          ) : (
            <>
              <button type="button" onClick={onCancel} disabled={salvando}
                className="rounded-lg border border-[#243A66] px-4 py-2 text-xs font-semibold text-[#9BAFC5] hover:text-[#F5F1E8] disabled:opacity-40">
                Cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={!podeConfirmar}
                className="flex items-center gap-1.5 rounded-lg border border-[#F26D6D]/60 bg-[#F26D6D]/15 px-4 py-2 text-xs font-bold text-[#F26D6D] hover:bg-[#F26D6D]/25 disabled:opacity-40 disabled:cursor-not-allowed">
                {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Emitir o código
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

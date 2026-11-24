"use client";
// Quadro "Assinatura da equipe" do master Enterprise (BRIEF docs/briefs/2026-11-23_enterprise-assinatura-da-equipe.md).
// O master cobra por fora; aqui registra o que cobra e marca quando recebeu. Gravação e regras na rota.
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pencil, Undo2, Users, X } from "lucide-react";
import { confirmar } from "@/lib/aviso";
import {
  PERIODICIDADES, ROTULO_PERIODICIDADE, dataBr, dataDoBr, lerValor, rotuloSituacao, vencimentoEmAberto,
  type AssinaturaEquipe, type Periodicidade, type Situacao,
} from "@/lib/enterprise-assinatura";

interface Linha { id: string; nome: string; ativo: boolean; registro: AssinaturaEquipe | null; situacao: Situacao }

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const input = "h-8 px-2 rounded bg-secondary border border-border text-foreground text-xs";

/** Máscara de moeda enquanto digita: só dígitos, dois últimos são centavos. */
function mascaraBrl(v: string): string {
  const d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Edicao({ linha, hoje, onSalvo, onCancelar }: { linha: Linha; hoje: string; onSalvo: (l: Linha) => void; onCancelar: () => void }) {
  const r = linha.registro;
  const [cobra, setCobra] = useState(r?.cobra ?? true);
  const [valor, setValor] = useState(r ? r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(r?.periodicidade ?? "MENSAL");
  const [dia, setDia] = useState(String(r?.dia_vencimento ?? 10));
  const [inicio, setInicio] = useState(dataBr(r?.inicio ?? hoje));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const iso = dataDoBr(inicio);
    if (cobra && !iso) { setErro("Início no formato DD/MM/AAAA."); return; }
    const v = lerValor(valor);
    if (cobra && (v == null || v <= 0)) { setErro("Informe o valor."); return; }
    const reinicia = cobra && (!r || !r.cobra || r.periodicidade !== periodicidade || r.dia_vencimento !== Number(dia) || r.inicio !== iso);
    if (reinicia && r?.pago_ate) {
      const ok = await confirmar("Isso reinicia a contagem dos vencimentos a partir do início informado. O último pagamento registrado deixa de aparecer aqui (o histórico fica guardado).", { titulo: "Reiniciar vencimentos", botao: "Continuar" });
      if (!ok) return;
    }
    setSalvando(true);
    const res = await fetch("/api/enterprise/assinaturas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cobra ? { id: linha.id, cobra: true, valor: v, periodicidade, dia_vencimento: Number(dia), inicio: iso } : { id: linha.id, cobra: false }),
    });
    const j = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) { setErro(j.error ?? "Não foi possível salvar."); return; }
    onSalvo({ ...linha, registro: j.registro, situacao: j.situacao });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-background/40">
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="checkbox" checked={cobra} onChange={(e) => setCobra(e.target.checked)} /> Cobrar deste usuário
      </label>
      {cobra && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="text-[10px] text-muted-foreground">Valor (R$)
            <input className={`${input} w-full`} inputMode="numeric" value={valor} onChange={(e) => setValor(mascaraBrl(e.target.value))} placeholder="0,00" />
          </label>
          <label className="text-[10px] text-muted-foreground">Periodicidade
            <select className={`${input} w-full`} value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}>
              {PERIODICIDADES.map((p) => <option key={p} value={p}>{ROTULO_PERIODICIDADE[p]}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-muted-foreground">Dia de vencimento
            <select className={`${input} w-full`} value={dia} onChange={(e) => setDia(e.target.value)}>
              {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-muted-foreground">Início da cobrança
            <input className={`${input} w-full`} inputMode="numeric" value={inicio} placeholder="DD/MM/AAAA"
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 8); setInicio([d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/")); }} />
          </label>
        </div>
      )}
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
      <div className="flex gap-2">
        <button onClick={salvar} disabled={salvando} className="h-8 px-3 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-40 flex items-center gap-1.5">
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar
        </button>
        <button onClick={onCancelar} className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancelar</button>
      </div>
    </div>
  );
}

export function AssinaturaEquipeEnterprise() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [hoje, setHoje] = useState("");
  const [indisponivel, setIndisponivel] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(() => {
    return fetch("/api/enterprise/assinaturas").then((x) => x.json()).catch(() => null).then((r) => {
      setLinhas(r?.usuarios ?? []);
      setHoje(r?.hoje ?? "");
      setIndisponivel(!!r?.indisponivel);
    });
  }, []);
  useEffect(() => {
    fetch("/api/enterprise/assinaturas").then((x) => x.json()).catch(() => null).then((r) => {
      setLinhas(r?.usuarios ?? []);
      setHoje(r?.hoje ?? "");
      setIndisponivel(!!r?.indisponivel);
    });
  }, []);

  async function acao(l: Linha, tipo: "registrar" | "desfazer") {
    const r = l.registro!;
    const data = tipo === "registrar" ? vencimentoEmAberto(r) : r.pago_ate!;
    const ok = tipo === "registrar"
      ? await confirmar(`Registrar o pagamento de ${brl(r.valor)} de ${l.nome}, referente ao vencimento de ${dataBr(data)}?`, { titulo: "Registrar pagamento", botao: "Registrar" })
      : await confirmar(`Desfazer o registro do vencimento de ${dataBr(data)} de ${l.nome}? A situação volta a mostrar esse vencimento em aberto.`, { titulo: "Desfazer registro", botao: "Desfazer", perigo: true });
    if (!ok) return;
    setEnviando(l.id); setMsg(null);
    const res = await fetch("/api/enterprise/assinaturas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tipo === "registrar" ? { id: l.id, registrar_pagamento: data } : { id: l.id, desfazer_pagamento: data }),
    });
    const j = await res.json().catch(() => ({}));
    setEnviando(null);
    if (!res.ok) { setMsg(j.error ?? "Não foi possível salvar."); if (res.status === 409) void carregar(); return; }
    setLinhas((xs) => (xs ?? []).map((x) => (x.id === l.id ? { ...x, registro: j.registro, situacao: j.situacao } : x)));
  }

  return (
    <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-3">
      <div>
        <p className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2"><Users className="w-4 h-4 text-[#C9A84C]" /> Assinatura da equipe</p>
        <p className="text-xs text-[#7A8FA8] mt-0.5">A cobrança é feita por você, fora da plataforma. Aqui você registra o valor e marca quando recebeu.</p>
      </div>
      {indisponivel && <p className="text-xs text-amber-400">Informação indisponível até a atualização do banco.</p>}
      {linhas === null ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : linhas.length === 0 ? (
        <p className="text-xs text-[#7A8FA8]">Você ainda não tem usuários. Cadastre em Enterprise › Usuários.</p>
      ) : (
        <div className="space-y-2">
          {linhas.map((l) => (
            <div key={l.id} className="rounded-xl border border-[#243A66] p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-[#F0ECE4]">{l.nome}{!l.ativo && <span className="ml-2 text-[10px] text-[#7A8FA8]">(inativo)</span>}</p>
                  <p className="text-xs text-[#7A8FA8]">
                    {l.registro?.cobra
                      ? `${brl(l.registro.valor)} · ${ROTULO_PERIODICIDADE[l.registro.periodicidade]} · vence dia ${l.registro.dia_vencimento}`
                      : "Sem cobrança"}
                  </p>
                  <p className={`text-xs mt-0.5 ${l.situacao.tipo === "VENCIDA" ? "text-red-400" : "text-[#9BAFC5]"}`}>{rotuloSituacao(l.situacao)}</p>
                  {l.registro?.cobra && <p className="text-[11px] text-[#7A8FA8]">Último vencimento pago: {l.registro.pago_ate ? dataBr(l.registro.pago_ate) : "nenhum"}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {l.registro?.cobra && (
                    <button onClick={() => acao(l, "registrar")} disabled={enviando === l.id || indisponivel}
                      className="h-8 px-3 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-40 flex items-center gap-1.5">
                      {enviando === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Registrar pagamento
                    </button>
                  )}
                  {l.registro?.cobra && (
                    <button onClick={() => acao(l, "desfazer")} disabled={!l.registro.pago_ate || enviando === l.id || indisponivel}
                      className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground disabled:opacity-40 flex items-center gap-1.5">
                      <Undo2 className="w-3.5 h-3.5" /> Desfazer último registro
                    </button>
                  )}
                  <button onClick={() => setEditando(editando === l.id ? null : l.id)} disabled={indisponivel}
                    className="h-8 px-3 rounded-lg border border-border text-xs text-foreground disabled:opacity-40 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> {l.registro ? "Alterar" : "Definir cobrança"}
                  </button>
                </div>
              </div>
              {editando === l.id && hoje && (
                <Edicao linha={l} hoje={hoje} onCancelar={() => setEditando(null)}
                  onSalvo={(nova) => { setLinhas((xs) => (xs ?? []).map((x) => (x.id === nova.id ? nova : x))); setEditando(null); }} />
              )}
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-xs text-[#9BAFC5]">{msg}</p>}
    </div>
  );
}

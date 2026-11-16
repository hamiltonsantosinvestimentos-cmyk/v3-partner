"use client";

// Painel "Criações e bloqueios" do ADMIN (BRIEF 15/11/2026): mostra as chaves da cota, o controle vigente do usuário e as
// últimas criações e recusas, e permite suspender ou liberar a criação de operações. Modal que só fecha por botão
// explícito (nunca clicando fora nem com Escape), sem window.confirm, motivo obrigatório, nota do porquê nos botões.
// O papel ADMIN é validado no servidor (/api/admin/creation-*); esconder o botão não protege nada por si só.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Dica } from "@/components/shared/dica";

interface Registro { id: string; via: string; outcome: string; ip: string | null; created_at: string }
interface Painel {
  chaves: { ip_registro_ativo: boolean; bloqueio_automatico_ativo: boolean };
  controle: { blocked_until: string | null; block_reason: string | null; override_hora: number | null; override_dia: number | null } | null;
  bloqueio_vigente: boolean;
  registros: Registro[];
}

const RESULTADOS: Record<string, string> = {
  ok: "Criado",
  cancelado: "Falhou e a vaga foi devolvida",
  negado_intervalo: "Recusado: intervalo mínimo",
  negado_hora: "Recusado: limite da hora",
  negado_dia: "Recusado: limite do dia",
  negado_bloqueio: "Recusado: criação suspensa",
};
const MOTIVOS: Record<string, string> = {
  suspensao_manual: "Suspensão manual do administrador",
  cota_horaria_excedida: "Bloqueio automático: limite da hora",
  cota_diaria_excedida: "Bloqueio automático: limite do dia",
};
const VIAS: Record<string, string> = {
  "ma-deals": "Mesa M&A",
  "consorcio-projetos": "Consórcio (projeto)",
  "consorcio-cartas": "Consórcio (carta)",
  "cm-intake": "Link de captação",
  parceria: "Adesão de parceria",
};

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const inputCls = "w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-sm px-3 py-2.5 placeholder:text-[#9BAFC5]/60 focus:outline-none focus:border-[#C9A84C] transition-colors";
const labelCls = "flex items-center gap-1.5 text-[11px] font-semibold text-[#9BAFC5] mb-1.5";

export function CreationControlDialog({ user, onClose }: { user: { id: string; full_name: string | null; role: string } | null; onClose: () => void }) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [acao, setAcao] = useState<"suspender" | "liberar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [horas, setHoras] = useState("24");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (id: string) => {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch(`/api/admin/creation-log?user_id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as Painel & { error?: string };
      if (!r.ok) { setErro(j.error ?? "Não foi possível carregar o painel."); setPainel(null); }
      else setPainel(j);
    } catch {
      setErro("Não foi possível carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    setAcao(null); setMotivo(""); setHoras("24"); setPainel(null); setErro("");
    if (user) void carregar(user.id);
  }, [user, carregar]);

  async function confirmar() {
    if (!user || !acao) return;
    const m = motivo.trim();
    if (m.length < 5) { setErro("O motivo precisa ter pelo menos 5 caracteres."); return; }
    const h = Number(horas);
    if (acao === "suspender" && (!Number.isInteger(h) || h < 1 || h > 720)) { setErro("Informe de 1 a 720 horas."); return; }
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/creation-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: user.id, acao, motivo: m, ...(acao === "suspender" ? { horas: h } : {}) }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErro(j.error ?? "Não foi possível concluir."); return; }
      setAcao(null); setMotivo("");
      await carregar(user.id);
    } catch {
      setErro("Não foi possível concluir.");
    } finally {
      setSalvando(false);
    }
  }

  const c = painel?.controle;
  return (
    <Dialog open={!!user}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-2xl w-[calc(100vw-32px)] max-h-[88vh] overflow-y-auto border border-[#243A66] [&>button.absolute]:hidden"
      >
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F5F1E8]">
          <ShieldOff className="w-4 h-4 text-[#C9A84C] flex-shrink-0" aria-hidden="true" />
          Criações e bloqueios
        </DialogTitle>
        <p className="text-xs text-[#9BAFC5] -mt-2">{user?.full_name ?? "Usuário sem nome"} · {user?.role}</p>

        {carregando && <p className="text-xs text-[#9BAFC5] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</p>}
        {erro && <p role="alert" className="text-xs text-[#F26D6D] rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/5 px-3 py-2">{erro}</p>}

        {painel && (
          <>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-lg border border-[#243A66] px-3 py-2.5">
                <p className="text-[#9BAFC5] mb-0.5">Bloqueio automático</p>
                <p className="font-semibold text-[#F5F1E8]">{painel.chaves.bloqueio_automatico_ativo ? "Ligado" : "Desligado"}</p>
              </div>
              <div className="rounded-lg border border-[#243A66] px-3 py-2.5">
                <p className="text-[#9BAFC5] mb-0.5">Registro de IP <Dica id="cota_ip_painel" className="ml-1" /></p>
                <p className="font-semibold text-[#F5F1E8]">{painel.chaves.ip_registro_ativo ? "Ligado" : "Desligado"}</p>
              </div>
            </div>

            <div className={`rounded-lg border px-3 py-2.5 text-[12px] ${painel.bloqueio_vigente ? "border-[#F26D6D]/40 bg-[#F26D6D]/5" : "border-[#243A66]"}`}>
              {painel.bloqueio_vigente && c?.blocked_until ? (
                <p className="text-[#F5F1E8]">
                  <strong>Criação suspensa até {dataHora(c.blocked_until)}.</strong>{" "}
                  Motivo: {MOTIVOS[c.block_reason ?? ""] ?? "não informado"}.
                </p>
              ) : (
                <p className="text-[#F5F1E8]">Criação liberada.</p>
              )}
              {(c?.override_hora || c?.override_dia) && (
                <p className="text-[#9BAFC5] mt-1">Limite próprio: {c.override_hora ?? "padrão"} por hora e {c.override_dia ?? "padrão"} por dia.</p>
              )}
            </div>

            {!acao && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setAcao("suspender"); setErro(""); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#F26D6D]/50 px-3 py-2 text-xs font-semibold text-[#F26D6D] hover:bg-[#F26D6D]/10">
                  Suspender criação <Dica id="cota_suspender" />
                </button>
                {painel.bloqueio_vigente && (
                  <button type="button" onClick={() => { setAcao("liberar"); setErro(""); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/50 px-3 py-2 text-xs font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10">
                    Liberar criação <Dica id="cota_liberar" />
                  </button>
                )}
              </div>
            )}

            {acao && (
              <div className="rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/5 p-3 space-y-3">
                <p className="flex items-start gap-2 text-[12px] text-[#F5F1E8]">
                  <AlertTriangle className="w-4 h-4 text-[#F5B942] flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {acao === "suspender"
                    ? "O usuário não conseguirá criar novos registros pelo prazo escolhido. O login continua ativo e ele verá a mensagem de suspensão."
                    : "A suspensão será encerrada agora e o usuário volta a criar registros, respeitando os limites normais."}
                </p>
                {acao === "suspender" && (
                  <div>
                    <label htmlFor="cc-horas" className={labelCls}>Duração em horas (1 a 720)</label>
                    <input id="cc-horas" inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputCls} />
                  </div>
                )}
                <div>
                  <label htmlFor="cc-motivo" className={labelCls}>Motivo (obrigatório, 5 a 500 caracteres)</label>
                  <textarea id="cc-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={salvando} onClick={() => { setAcao(null); setMotivo(""); setErro(""); }}
                    className="rounded-lg border border-[#243A66] px-3 py-2 text-xs font-semibold text-[#9BAFC5] hover:bg-[#243A66]/40 disabled:opacity-50">Voltar</button>
                  <button type="button" disabled={salvando} onClick={confirmar}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#F26D6D] px-3 py-2 text-xs font-bold text-[#09081A] hover:opacity-90 disabled:opacity-50">
                    {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {acao === "suspender" ? "Confirmar suspensão" : "Confirmar liberação"}
                  </button>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold text-[#9BAFC5] mb-1.5">Últimas criações e recusas</p>
              {painel.registros.length === 0 ? (
                <p className="text-xs text-[#9BAFC5]">Nenhum registro ainda.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#243A66]">
                  <table className="w-full text-[11px]">
                    <thead><tr className="text-left text-[#9BAFC5]">
                      <th className="px-3 py-2 font-semibold">Quando</th><th className="px-3 py-2 font-semibold">Onde</th>
                      <th className="px-3 py-2 font-semibold">Resultado</th>
                      {painel.chaves.ip_registro_ativo && <th className="px-3 py-2 font-semibold">IP</th>}
                    </tr></thead>
                    <tbody>
                      {painel.registros.map((l) => (
                        <tr key={l.id} className="border-t border-[#243A66] text-[#F5F1E8]">
                          <td className="px-3 py-1.5 whitespace-nowrap">{dataHora(l.created_at)}</td>
                          <td className="px-3 py-1.5">{VIAS[l.via] ?? l.via}</td>
                          <td className="px-3 py-1.5">{RESULTADOS[l.outcome] ?? l.outcome}</td>
                          {painel.chaves.ip_registro_ativo && <td className="px-3 py-1.5">{l.ip ?? "sem registro"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} disabled={salvando}
            className="rounded-lg border border-[#243A66] px-4 py-2 text-xs font-semibold text-[#F5F1E8] hover:bg-[#243A66]/40 disabled:opacity-50">Fechar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

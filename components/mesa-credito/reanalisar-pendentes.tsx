"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botão "Reanalisar" dos Pedidos de Partners: mostra o que já foi consultado nesta análise e, ao
// clicar, consulta SÓ as fontes que ainda faltam (Serasa e/ou BACEN), atualizando a mesma análise.
// Nada é reconsultado, então não gera cobrança repetida. Ver lib/credit-reanalysis.ts.

interface EstadoFonte {
  fonte: "serasa" | "bacen";
  label: string;
  consultada: boolean;
  habilitada: boolean;
  ultimo_erro: string | null;
  duplicada: boolean;
}

interface Estado {
  fontes: EstadoFonte[];
  pendentes: string[];
  configurado: { serasa: boolean; bacen: boolean };
}

interface Resultado {
  mensagem: string;
  atualizadas: { fonte: string; label: string }[];
  falhas: { fonte: string; label: string; erro: string }[];
  pdf_regenerado: boolean;
}

export function ReanalisarPendentes({
  proposalId,
  onUpdated,
  jaGerouRelatorio,
}: {
  proposalId: string;
  onUpdated: () => void;
  /** Já existe relatório público gerado: avisa que é preciso gerá-lo de novo para sair com os dados novos. */
  jaGerouRelatorio?: boolean;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Segundo clique obrigatório antes de pagar de novo um SCR recusado por consulta repetida
  const [confirmarCobranca, setConfirmarCobranca] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/credit-engine/reanalyze?proposal_id=${proposalId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao verificar a análise");
      setEstado(json);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function reanalisar(forcarBacen = false) {
    setBusy(true);
    setErro(null);
    setResultado(null);
    setConfirmarCobranca(false);
    try {
      const res = await fetch("/api/credit-engine/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId, forcar_bacen: forcarBacen }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha na reanálise");
      setResultado(json);
      await carregar();
      onUpdated();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Verificando fontes consultadas…</div>;
  }
  if (!estado) {
    return erro ? <p className="text-[11px] text-red-400">{erro}</p> : null;
  }

  const fontes = estado.fontes.filter((f) => f.habilitada);
  const pendentes = fontes.filter((f) => !f.consultada);
  const semCredencial = pendentes.filter((f) => !estado.configurado[f.fonte]);
  const bacenDuplicado = pendentes.some((f) => f.fonte === "bacen" && f.duplicada);

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fontes desta análise</p>
          <ul className="space-y-1">
            {fontes.map((f) => (
              <li key={f.fonte} className="flex items-start gap-1.5 text-xs">
                {f.consultada
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-px" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-px" />}
                <span className="min-w-0">
                  <span className={f.consultada ? "text-foreground" : "text-amber-300"}>
                    {f.label} — {f.consultada ? "consultado" : "não consultado"}
                  </span>
                  {!f.consultada && f.ultimo_erro && (
                    <span className="block text-[10px] text-muted-foreground break-words">Último erro: {f.ultimo_erro}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Button
          size="sm"
          variant={pendentes.length ? "default" : "outline"}
          disabled={busy || pendentes.length === 0}
          onClick={() => reanalisar()}
          title={pendentes.length ? "Consulta só o que ainda não foi consultado" : "Todas as fontes já foram consultadas"}
          className="flex-shrink-0"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {busy ? "Consultando…" : "Reanalisar"}
        </Button>
      </div>

      {pendentes.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Vai consultar apenas: {pendentes.map((f) => f.label).join(" e ")}. O que já foi consultado não é refeito nem cobrado de novo.
        </p>
      )}
      {bacenDuplicado && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] space-y-1.5">
          <p className="text-amber-300">
            O CheckTudo recusou o SCR porque este documento já foi consultado há pouco. Repetir agora gera uma nova cobrança.
          </p>
          {confirmarCobranca ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Confirma a nova cobrança do SCR?</span>
              <Button size="sm" disabled={busy} onClick={() => reanalisar(true)}>
                Confirmar e consultar
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmarCobranca(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmarCobranca(true)}>
              Consultar SCR mesmo assim (nova cobrança)
            </Button>
          )}
        </div>
      )}
      {semCredencial.length > 0 && (
        <p className="text-[11px] text-amber-400">
          {semCredencial.map((f) => f.label).join(" e ")}: credencial ainda não configurada no portal — essa consulta vai falhar até ser configurada.
        </p>
      )}

      {resultado && (
        <div className={`rounded-md border px-2.5 py-2 text-[11px] space-y-1 ${resultado.falhas.length ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
          <p className={resultado.falhas.length ? "text-amber-300" : "text-emerald-300"}>{resultado.mensagem}</p>
          {resultado.falhas.map((f) => (
            <p key={f.fonte} className="text-muted-foreground break-words">{f.label}: {f.erro}</p>
          ))}
          {resultado.atualizadas.length > 0 && jaGerouRelatorio && (
            <p className="text-muted-foreground">O dossiê da Mesa foi atualizado. Para o relatório do cliente sair com os dados novos, use “Gerar novamente” abaixo (isso troca o link público).</p>
          )}
        </div>
      )}
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}

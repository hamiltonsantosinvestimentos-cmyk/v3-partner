"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Link2, Unlink, Loader2 } from "lucide-react";

// Modal da proposta › Documentos: NDA (Mesa de operações) do cliente (30/09/2026).
// Mostra os NDAs vinculados a esta proposta e permite vincular um NDA já
// gerado pelo painel "NDA para clientes" da Mesa Operacional (ou desvincular).

type Contrato = {
  id: string; contract_code: string | null; status_signature: string; credit_proposal_id: string | null;
  parties: Array<{ name?: string | null; email?: string | null }> | null; created_at: string;
};

const STATUS: Record<string, { label: string; color: string }> = {
  assinado: { label: "Assinado", color: "#34D399" },
  enviado_assinatura: { label: "Aguardando assinatura", color: "#60A5FA" },
  rascunho: { label: "Gerado, não enviado", color: "#F59E0B" },
};

const nomeParte = (c: Contrato) => (c.parties ?? []).map((p) => p?.name).filter(Boolean)[0] ?? "—";

export function NdaVinculoProposta({ proposalId }: { proposalId: string }) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [escolhido, setEscolhido] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await fetch("/api/mesa-op/nda-clientes?contratos=1");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao carregar NDAs");
      setContratos(j.contratos ?? []);
    } catch (e) { setErro((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function vincular(contractId: string, credit_proposal_id: string | null) {
    setBusy(true); setErro(null);
    try {
      const r = await fetch(`/api/mesa-op/nda-clientes/${contractId}/vincular`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credit_proposal_id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao salvar vínculo");
      setEscolhido("");
      await carregar();
    } catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  }

  const vinculados = contratos.filter((c) => c.credit_proposal_id === proposalId);
  const disponiveis = contratos.filter((c) => !c.credit_proposal_id && c.status_signature !== "rascunho");

  return (
    <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#12112A] space-y-2.5">
      <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> NDA do cliente
      </p>
      {loading ? (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Carregando...</p>
      ) : (
        <>
          {vinculados.length === 0 && <p className="text-[10px] text-muted-foreground">Nenhum NDA vinculado a esta proposta.</p>}
          {vinculados.map((c) => {
            const st = STATUS[c.status_signature] ?? { label: c.status_signature, color: "#9BAFC5" };
            return (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#162744] border border-[#9BAFC5]/10">
                <span className="text-[11px] font-mono text-[#C9A84C]">{c.contract_code ?? "NDA"}</span>
                <span className="text-[11px] text-[#F5F1E8] truncate flex-1">{nomeParte(c)}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
                <button type="button" title="Desvincular" disabled={busy} onClick={() => vincular(c.id, null)}
                  className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-40">
                  <Unlink className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)}
              className="flex-1 h-8 px-2 text-[11px] bg-[#162744] border border-[#9BAFC5]/10 rounded-md text-[#F5F1E8] focus:outline-none">
              <option value="">{disponiveis.length ? "Vincular NDA de cliente já enviado..." : "Nenhum NDA de cliente sem vínculo"}</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_code ?? "NDA"} · {nomeParte(c)} · {(STATUS[c.status_signature]?.label ?? c.status_signature)}
                </option>
              ))}
            </select>
            <button type="button" disabled={!escolhido || busy} onClick={() => vincular(escolhido, proposalId)}
              className="h-8 px-3 rounded-md border border-[#C9A84C]/40 text-[11px] font-semibold text-[#E8C97A] hover:bg-[#C9A84C]/10 flex items-center gap-1 disabled:opacity-40">
              <Link2 className="w-3 h-3" /> Vincular
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">NDAs de cliente são enviados pela Mesa Operacional › Contratos › &quot;NDA para clientes&quot;.</p>
        </>
      )}
      {erro && <p className="text-[10px] text-red-400">{erro}</p>}
    </div>
  );
}

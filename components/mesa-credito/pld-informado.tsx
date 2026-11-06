"use client";

// Quadro de PLD informado pelo partner na API (Termo v2.1, cláusula 7.4). Só a mesa vê:
// o componente só é montado com canChangeStage, e a rota recusa quem não é da mesa.
import React, { useEffect, useState } from "react";

type Pld = { pep: string | null; beneficiario_final: { nome?: string; cpf?: string } | null; circunstancia_atipica: string | null; created_at: string };
const PEP: Record<string, string> = { SIM: "Sim", NAO: "Não", NAO_SEI: "Não sabe" };

export function PldInformado({ proposalId }: { proposalId: string }) {
  const [pld, setPld] = useState<Pld | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/credit-proposals/${proposalId}/pld`).then((r) => r.ok ? r.json() : null).then((j) => { if (vivo) setPld(j?.pld ?? null); }).catch(() => {});
    return () => { vivo = false; };
  }, [proposalId]);
  if (!pld) return null;
  const alerta = pld.pep === "SIM" || !!pld.circunstancia_atipica;
  return (
    <div className={`rounded-xl border p-4 space-y-2 text-xs ${alerta ? "border-red-500/40 bg-red-500/5" : "border-[#162744] bg-[#111F35]"}`}>
      <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#C9A84C]">PLD informado pelo partner (só a mesa vê)</p>
      <p className="text-[#7A8FA8]">Pessoa exposta politicamente: <b className="text-[#F0ECE4]">{pld.pep ? PEP[pld.pep] ?? pld.pep : "Não informado"}</b></p>
      {pld.beneficiario_final && <p className="text-[#7A8FA8]">Beneficiário final: <b className="text-[#F0ECE4]">{pld.beneficiario_final.nome} · {pld.beneficiario_final.cpf}</b></p>}
      {pld.circunstancia_atipica && <p className="text-[#7A8FA8] whitespace-pre-wrap">Circunstância atípica: <span className="text-[#F0ECE4]">{pld.circunstancia_atipica}</span></p>}
      <p className="text-[10px] text-[#7A8FA8]">Não comunique ao cliente a existência de apuração (Termo de Uso da API, cláusula 7.4).</p>
    </div>
  );
}

"use client";

import { PipefyConfig } from "@/components/shared/pipefy-config";

const N1_STAGES = [
  { localStage: "recebido",  label: "Recebido" },
  { localStage: "triagem",   label: "Triagem" },
  { localStage: "analise",   label: "Análise" },
  { localStage: "pendencia", label: "Pendência" },
  { localStage: "aprovacao", label: "Em Aprovação" },
  { localStage: "finalizado", label: "Finalizado" },
];

export function PipefyCreditoConfig() {
  return (
    <div className="space-y-8">
      {/* N1 */}
      <div>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">
            1
          </span>
          N1 — Crédito Varejo
        </h3>
        <PipefyConfig
          mesaName="Crédito N1"
          storageKey="mesa_credito_n1"
          stageMapping={N1_STAGES}
        />
      </div>

      {/* N2 */}
      <div className="border-t border-[#122036] pt-8">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">
            2
          </span>
          N2 — Crédito Estruturado
        </h3>
        <PipefyConfig
          mesaName="Crédito N2"
          storageKey="mesa_credito_n2"
          stageMapping={N1_STAGES}
        />
      </div>

      {/* N3 */}
      <div className="border-t border-[#122036] pt-8">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-bold">
            3
          </span>
          N3 — High Ticket
        </h3>
        <PipefyConfig
          mesaName="Crédito N3"
          storageKey="mesa_credito_n3"
          stageMapping={N1_STAGES}
        />
      </div>
    </div>
  );
}

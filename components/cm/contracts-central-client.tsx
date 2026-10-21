"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileText, LayoutList, Settings, Clock, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractTemplatesClient } from "./contract-templates-client";
import { ContractsPanelClient } from "./contracts-panel-client";
import { EsignatureConfigClient } from "./esignature-config-client";
import { PendingQualificationsPanel } from "./pending-qualifications-panel";
import { CommissionGridsPanel } from "./commission-grids-panel";

const TABS = [
  { id: "painel", label: "Contratos Gerados", icon: <LayoutList size={15} /> },
  { id: "minutas", label: "Minutas (Templates)", icon: <FileText size={15} /> },
  // Qualificações Pendentes (11/09/2026, pedido de João: "aonde consigo ver
  // os contratos pendentes aguardando qualificação? isso não está previsto
  // no UX?") -- gap real, nenhuma tela agregava os lotes em aberto do
  // sistema inteiro antes desta aba.
  { id: "pendencias", label: "Qualificações Pendentes", icon: <Clock size={15} /> },
  // Grade de Comissão (06/10/2026): link por grupo para o representante informar o percentual de cada integrante.
  { id: "grade", label: "Grade de Comissão", icon: <Percent size={15} /> },
  { id: "config", label: "Configurações", icon: <Settings size={15} /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Aba "Configurações" (Fase 3, 10/09/2026): switch de provedor de assinatura
// digital por vertical, ADMIN/GESTAO estrito (mesmo gate de
// /api/contracts/esignature-config) -- MESA_OPERACIONAL acessa a Central de
// Contratos, mas nunca decide qual provedor de assinatura a V3 usa.
function ContractsCentralInner({ role }: { role: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // "Abrir contrato" (BRIEF 20/10/2026): ?contrato=<id> abre a aba de contratos
  // gerados com o contrato já selecionado; o parâmetro sai da URL depois de usado.
  const [openContractId, setOpenContractId] = useState<string | null>(searchParams.get("contrato"));
  const [tab, setTab] = useState<TabId>(
    searchParams.get("contrato") ? "painel" : searchParams.get("vertical") || searchParams.get("template_id") ? "minutas" : "painel"
  );
  const canConfig = ["ADMIN", "GESTAO"].includes(role);
  const visibleTabs = TABS.filter((t) => (t.id !== "config" && t.id !== "grade") || canConfig);

  // Deep-link de "Qualificações Pendentes" pra "Minutas" (reaproveita o
  // auto-select por ?template_id= que já existia em ContractTemplatesClient
  // pro link de notificação/e-mail dos sócios).
  const openMinuta = (templateId: string) => {
    router.push(`/juridico/contratos?template_id=${templateId}`);
    setTab("minutas");
  };

  const openContract = (contractId: string) => {
    router.push(`/juridico/contratos?contrato=${contractId}`);
    setOpenContractId(contractId);
    setTab("painel");
  };
  const clearOpenContract = () => {
    setOpenContractId(null);
    if (searchParams.get("contrato")) router.replace("/juridico/contratos");
  };

  return (
    <div>
      <div className="flex gap-1 px-6 pt-4 border-b border-[#9BAFC5]/10">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2",
              tab === t.id
                ? "text-[#C9A84C] border-[#C9A84C] bg-[#162744]/50"
                : "text-[#9BAFC5] border-transparent hover:text-[#F5F1E8]"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "painel" && <ContractsPanelClient role={role} initialContractId={openContractId} onInitialContractHandled={clearOpenContract} />}
      {tab === "minutas" && <ContractTemplatesClient onOpenContract={openContract} role={role} />}
      {tab === "pendencias" && <PendingQualificationsPanel onOpenMinuta={openMinuta} />}
      {tab === "grade" && canConfig && <CommissionGridsPanel />}
      {tab === "config" && canConfig && <EsignatureConfigClient />}
    </div>
  );
}

export function ContractsCentralClient({ role }: { role: string }) {
  return (
    <Suspense fallback={null}>
      <ContractsCentralInner role={role} />
    </Suspense>
  );
}

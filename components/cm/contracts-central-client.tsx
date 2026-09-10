"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, LayoutList, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractTemplatesClient } from "./contract-templates-client";
import { ContractsPanelClient } from "./contracts-panel-client";
import { EsignatureConfigClient } from "./esignature-config-client";

const TABS = [
  { id: "painel", label: "Contratos Gerados", icon: <LayoutList size={15} /> },
  { id: "minutas", label: "Minutas (Templates)", icon: <FileText size={15} /> },
  { id: "config", label: "Configurações", icon: <Settings size={15} /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Aba "Configurações" (Fase 3, 10/09/2026): switch de provedor de assinatura
// digital por vertical, ADMIN/GESTAO estrito (mesmo gate de
// /api/contracts/esignature-config) -- MESA_OPERACIONAL acessa a Central de
// Contratos, mas nunca decide qual provedor de assinatura a V3 usa.
function ContractsCentralInner({ role }: { role: string }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(searchParams.get("vertical") ? "minutas" : "painel");
  const canConfig = ["ADMIN", "GESTAO"].includes(role);
  const visibleTabs = TABS.filter((t) => t.id !== "config" || canConfig);

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

      {tab === "painel" && <ContractsPanelClient />}
      {tab === "minutas" && <ContractTemplatesClient />}
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

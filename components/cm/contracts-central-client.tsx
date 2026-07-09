"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractTemplatesClient } from "./contract-templates-client";
import { ContractsPanelClient } from "./contracts-panel-client";

const TABS = [
  { id: "painel", label: "Contratos Gerados", icon: <LayoutList size={15} /> },
  { id: "minutas", label: "Minutas (Templates)", icon: <FileText size={15} /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ContractsCentralInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(searchParams.get("vertical") ? "minutas" : "painel");

  return (
    <div>
      <div className="flex gap-1 px-6 pt-4 border-b border-[#9BAFC5]/10">
        {TABS.map((t) => (
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
    </div>
  );
}

export function ContractsCentralClient() {
  return (
    <Suspense fallback={null}>
      <ContractsCentralInner />
    </Suspense>
  );
}

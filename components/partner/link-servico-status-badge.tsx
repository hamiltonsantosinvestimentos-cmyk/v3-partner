"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

const GO = "#C9A84C", GL = "#E8C97A", MU = "#9BAFC5";

interface LinkStatus {
  id: string;
  title: string;
  active: boolean;
  expires_at: string | null;
  total_uses: number;
  total_paid_cents: number;
}

// Status do Link de Serviço (partner_service_links, /meus-links) vinculado
// a esta proposta/deal (14/09/2026, pedido de João: "visualizar também no
// deal do ativo o status do link gerado"). Diferente do botão "Link
// Análise" (mecanismo separado, ?prop= em /analise-v2) que já existe nos
// mesmos modais -- este cobre o link self-service que o próprio partner
// pode ter criado em /meus-links pra este deal.
export function LinkServicoStatusBadge({ dealType, dealId }: { dealType: "credit" | "ma"; dealId: string }) {
  const [link, setLink] = useState<LinkStatus | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/partner/service-links/by-deal?deal_type=${dealType}&deal_id=${dealId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setLink((d.link as LinkStatus) ?? null); })
      .catch(() => { if (!cancelled) setLink(null); });
    return () => { cancelled = true; };
  }, [dealType, dealId]);

  if (link === "loading" || !link) return null;

  // Correção 14/09/2026: comparação de data direta pra "expirado" -- Math.ceil()
  // de uma diferença negativa pequena (expirado há menos de 24h) vira -0/0, que
  // não é < 0 em JS, e o badge mostraria "expira em 0d" pra um link já morto.
  const expired = link.expires_at ? new Date(link.expires_at).getTime() < Date.now() : false;
  const daysLeft = link.expires_at && !expired ? Math.ceil((new Date(link.expires_at).getTime() - Date.now()) / 86400000) : null;
  const status = expired ? "Expirado" : !link.active ? "Inativo" : daysLeft !== null ? `Ativo · expira em ${daysLeft}d` : "Ativo";
  const color = expired || !link.active ? "#f87171" : daysLeft !== null && daysLeft <= 3 ? "#f87171" : "#4ade80";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: GL, background: "rgba(201,168,76,0.08)", border: `1px solid ${GO}40`, borderRadius: 5, padding: "3px 8px" }}>
      <Link2 size={10} color={MU} />
      <span style={{ color: MU }}>Link de Serviço:</span>
      <span style={{ color, fontWeight: 700 }}>{status}</span>
    </div>
  );
}

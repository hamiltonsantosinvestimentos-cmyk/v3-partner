import { Suspense } from "react";
import { Metadata } from "next";
import { HomeEquityPublicoClient } from "@/components/simulador/home-equity-publico-client";

// Página PÚBLICA (fora do layout autenticado) — link que partners copiam no
// CRM (Pipeline > ação "Copiar link do Simulador") e enviam pra leads/clientes.
// Roda o mesmo motor de cálculo real usado internamente em /simulador-home-equity
// (SAC/PRICE, LTV 60%, taxa V3), só que sem exigir login e restrito à modalidade
// Home Equity / CGI (imóvel em garantia) — não expõe as outras linhas de crédito.
export const metadata: Metadata = {
  title: "Simulador Home Equity | V3 Partners",
  description: "Simule crédito com garantia de imóvel (Home Equity / CGI) com a V3 Partners — taxas, parcelas e prazos na hora.",
  robots: "noindex, nofollow",
};

export default function SimuladorHomeEquityPublicoPage() {
  return (
    <Suspense fallback={null}>
      <HomeEquityPublicoClient />
    </Suspense>
  );
}

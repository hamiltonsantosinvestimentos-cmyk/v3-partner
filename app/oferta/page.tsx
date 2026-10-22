import { Suspense } from "react";
import { Metadata } from "next";
import { OfertaLp } from "@/components/oferta/oferta-lp";
import { MetaPixel } from "@/components/quiz/meta-pixel";

// Página PÚBLICA — oferta única V3: 30 dias grátis, depois Gold, Diamante ou Partner PRO anual.
// Lead → /api/public/oferta. Ver lib/oferta-trial.ts.
export const metadata: Metadata = {
  title: "30 dias grátis na V3 Partners | Oferta única",
  description: "Use toda a estrutura da V3 Partners por 30 dias sem pagar nada. Depois, Gold (R$ 397/mês), Diamante (R$ 897/mês) ou Partner PRO anual. Sem fidelidade.",
  openGraph: {
    title: "30 dias grátis na V3 Partners",
    description: "Toda a estrutura da V3 para subir suas propostas. Sem cartão, sem fidelidade.",
    images: ["https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png"],
  },
};

export default function OfertaPage() {
  return (
    <>
      <MetaPixel />
      <Suspense fallback={null}>
        <OfertaLp />
      </Suspense>
    </>
  );
}

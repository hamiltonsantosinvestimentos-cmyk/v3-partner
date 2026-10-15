import { Suspense } from "react";
import { Metadata } from "next";
import { WebinarLp } from "@/components/webinar/webinar-lp";
import { MetaPixel } from "@/components/quiz/meta-pixel";

// Página PÚBLICA — LP do webinar "Crédito Estruturado com Garantia" (06/11, 20h, R$ 27).
// CTA → /webinar/checkout. Ver lib/webinar.ts.
export const metadata: Metadata = {
  title: "Webinar Crédito Estruturado com Garantia | V3 Partners",
  description: "06/11 às 20h, ao vivo: Cash Home, Cash Agro e como a V3 Partners estrutura operações de crédito com garantia. Ingresso R$ 27.",
  openGraph: {
    title: "Webinar Crédito Estruturado com Garantia | V3 Partners",
    description: "06/11 às 20h, ao vivo e online. Ingresso R$ 27.",
    images: ["https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png"],
  },
};

export default function WebinarPage() {
  return (
    <>
      <MetaPixel />
      <Suspense fallback={null}>
        <WebinarLp />
      </Suspense>
    </>
  );
}

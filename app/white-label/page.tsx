import { Suspense } from "react";
import { Metadata } from "next";
import { WhiteLabelQuizClient } from "@/components/quiz/white-label-quiz-client";
import { MetaPixel } from "@/components/quiz/meta-pixel";

// Página PÚBLICA (fora do layout autenticado) — quiz de qualificação para o White Label V3
// (operação própria, capital a partir de R$ 50 mil). Mesmo padrão do /seja-partner: link com
// ?ref=<partner_id> para atribuição; o lead cai em prospeccao_leads (origem quiz_white_label).
export const metadata: Metadata = {
  title: "White Label | V3 Partners",
  description: "Sua própria empresa de crédito, com a sua marca. Veja em 1 minuto se o White Label da V3 faz sentido para você.",
  robots: "noindex, nofollow",
};

export default function WhiteLabelPage() {
  return (
    <>
      <MetaPixel />
      <Suspense fallback={null}>
        <WhiteLabelQuizClient />
      </Suspense>
    </>
  );
}

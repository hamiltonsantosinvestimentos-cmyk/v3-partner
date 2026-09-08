import { Suspense } from "react";
import { Metadata } from "next";
import { PartnerQuizClient } from "@/components/quiz/partner-quiz-client";

// Página PÚBLICA (fora do layout autenticado) — quiz de qualificação para quem
// quer se tornar Partner V3. Mesmo padrão do Simulador Home Equity: link que
// partners copiam com ?ref=<partner_id> para recrutar sub-partners. O lead cai
// em prospeccao_leads (aba Prospecção Partners) com score e plano sugerido.
export const metadata: Metadata = {
  title: "Seja Partner | V3 Partners",
  description: "Descubra em 2 minutos se o modelo de parceria da V3 Partners faz sentido para o seu perfil.",
  robots: "noindex, nofollow",
};

export default function SejaPartnerPage() {
  return (
    <Suspense fallback={null}>
      <PartnerQuizClient />
    </Suspense>
  );
}

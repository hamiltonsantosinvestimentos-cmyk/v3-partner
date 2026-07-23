import { Metadata } from "next";
import { AnaliseLandingV2Client } from "@/components/analise/analise-landing-v2-client";
import { TrackingScripts } from "@/components/analytics/tracking-scripts";

export const metadata: Metadata = {
  title: "Análise de Crédito Empresarial: V3 Partners",
  description: "Descubra o perfil real de crédito da sua empresa e qual fundo tem mais chance de aprovar sua operação. Estruturação V3 Partners.",
  robots: "noindex, nofollow",
};

export default function AnaliseV2Page() {
  return (
    <>
      <TrackingScripts />
      <AnaliseLandingV2Client />
    </>
  );
}

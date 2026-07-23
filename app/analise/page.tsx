import { Metadata } from "next";
import { AnaliseLandingClient } from "@/components/analise/analise-landing-client";
import { TrackingScripts } from "@/components/analytics/tracking-scripts";

export const metadata: Metadata = {
  title: "Análise de Crédito Empresarial: V3 Partners",
  description: "Diagnóstico técnico do perfil de crédito da sua empresa antes de buscar capital no mercado. Estruturação V3 Partners.",
};

export default function AnalisePage() {
  return (
    <>
      <TrackingScripts />
      <AnaliseLandingClient />
    </>
  );
}

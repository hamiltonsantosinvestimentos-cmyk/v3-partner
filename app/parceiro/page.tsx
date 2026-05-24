import type { Metadata } from "next";
import { LandingPageClient } from "@/components/landing/landing-page-client";

export const metadata: Metadata = {
  title: "Seja um Partner V3 Partners — Boutique Financeira Institucional",
  description: "Acesse operações de crédito estruturado, M&A, securitização e real estate com até 50% de comissionamento. Junte-se à rede de partners V3 Partners.",
  openGraph: {
    title: "Seja um Partner V3 Partners",
    description: "Acesse operações de alto ticket com até 50% de comissionamento. Crédito estruturado, M&A, securitização e real estate.",
    type: "website",
  },
};

export default function ParceiroPaige() {
  return <LandingPageClient />;
}

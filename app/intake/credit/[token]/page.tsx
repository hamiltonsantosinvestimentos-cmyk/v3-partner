import { Metadata } from "next";
import { CreditIntakeClient } from "@/components/credit-intake/credit-intake-client";

export const metadata: Metadata = {
  title: "Consentimento e Registrato — V3 Partners",
  description: "Autorização de análise de crédito e envio do Registrato BACEN.",
  robots: "noindex, nofollow",
};

interface Props { params: Promise<{ token: string }> }

export default async function CreditIntakePage({ params }: Props) {
  const { token } = await params;
  return <CreditIntakeClient token={token} />;
}

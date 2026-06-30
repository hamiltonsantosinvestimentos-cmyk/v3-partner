import { Metadata } from "next";
import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = {
  title: "Checkout — V3 Partners",
  description: "Contrate serviços financeiros estruturados da V3 Partners.",
};

interface Props { params: Promise<{ token: string }> }

export default async function CheckoutPage({ params }: Props) {
  const { token } = await params;
  return <CheckoutClient token={token} />;
}

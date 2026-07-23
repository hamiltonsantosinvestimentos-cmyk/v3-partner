import { Metadata } from "next";
import { Suspense } from "react";
import { DirectCheckoutClient } from "@/components/checkout/direct-checkout-client";
import { TrackingScripts } from "@/components/analytics/tracking-scripts";

export const metadata: Metadata = {
  title: "Checkout: Análise de Crédito V3 Partners",
  description: "Finalize sua Análise de Crédito Empresarial V3 Partners.",
  robots: "noindex, nofollow",
};

export default function AnaliseCheckoutPage() {
  return (
    <>
      <TrackingScripts />
      <Suspense fallback={null}>
        <DirectCheckoutClient />
      </Suspense>
    </>
  );
}

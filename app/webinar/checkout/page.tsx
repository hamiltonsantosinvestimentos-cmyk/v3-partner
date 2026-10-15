import { Suspense } from "react";
import { Metadata } from "next";
import { WebinarCheckout } from "@/components/webinar/webinar-checkout";
import { MetaPixel } from "@/components/quiz/meta-pixel";

// Página PÚBLICA — checkout do webinar (Pix ou boleto da Cora). ?t=<token> retoma a inscrição.
export const metadata: Metadata = {
  title: "Inscrição no webinar | V3 Partners",
  robots: "noindex, nofollow",
};

export default function WebinarCheckoutPage() {
  return (
    <>
      <MetaPixel />
      <Suspense fallback={null}>
        <WebinarCheckout />
      </Suspense>
    </>
  );
}

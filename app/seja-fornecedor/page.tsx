import type { Metadata } from "next";
import { SupplierLandingClient } from "@/components/marketplace/supplier-landing-client";

export const metadata: Metadata = {
  title: "Seja Fornecedor | V3 Partners Marketplace",
  description: "Distribua seus produtos e serviços para uma rede qualificada de Partners financeiros em todo o Brasil. Cadastre-se no Marketplace V3 Partners.",
};

export default function SejaFornecedorPage() {
  return <SupplierLandingClient />;
}

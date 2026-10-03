import { Suspense } from "react";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA e SEPARADA do /cadastro-partner: link exclusivo do plano
// V3 Access (Projeto Repescagem, 02/10/2026) — R$ 1.447/ano, em até 10x sem
// juros no cartão, 20% de comissão (papel STARTER). O plano já vem travado e
// não aparece na lista pública de planos. Pública pelo prefixo
// "/cadastro-partner" em PUBLIC_ROUTES (proxy.ts).
export const metadata = {
  title: "V3 Access | V3 Partners",
  description:
    "Cadastro do plano V3 Access — Mesa de Crédito, chat ao vivo com a Mesa, CRM e 20% de comissão. R$ 1.447/ano, em até 10x sem juros no cartão.",
};

export default function CadastroPartnerAccessPage() {
  return (
    <Suspense>
      <CadastroPartnerForm forcePlano="STARTER" />
    </Suspense>
  );
}

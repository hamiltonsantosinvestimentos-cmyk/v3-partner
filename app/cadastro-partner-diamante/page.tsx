import { Suspense } from "react";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA: link exclusivo do plano V3 Diamante (oferta única, lib/oferta-trial.ts).
// Sem pagamento no cadastro: 30 dias grátis a partir da aprovação, depois R$ 897/mês.
export const metadata = {
  title: "V3 Diamante: 30 dias grátis | V3 Partners",
  description: "Cadastro do plano V3 Diamante: 30 dias grátis com toda a estrutura da V3, depois R$ 897/mês e 40% de comissão. Sem fidelidade.",
};

export default function CadastroPartnerDiamantePage() {
  return (
    <Suspense>
      <CadastroPartnerForm forcePlano="DIAMANTE" />
    </Suspense>
  );
}

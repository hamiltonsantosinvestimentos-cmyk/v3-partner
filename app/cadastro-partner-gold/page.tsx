import { Suspense } from "react";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA: link exclusivo do plano V3 Gold (oferta única, lib/oferta-trial.ts).
// Sem pagamento no cadastro: 30 dias grátis a partir da aprovação, depois R$ 397/mês.
export const metadata = {
  title: "V3 Gold: 30 dias grátis | V3 Partners",
  description: "Cadastro do plano V3 Gold: 30 dias grátis com toda a estrutura da V3, depois R$ 397/mês e 25% de comissão. Sem fidelidade.",
};

export default function CadastroPartnerGoldPage() {
  return (
    <Suspense>
      <CadastroPartnerForm forcePlano="GOLD" />
    </Suspense>
  );
}

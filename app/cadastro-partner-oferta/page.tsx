import { Suspense } from "react";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA: link único da oferta (lib/oferta-trial.ts). O candidato escolhe entre V3 Gold
// e V3 Diamante no mesmo cadastro; ?plano=gold|diamante já vem marcado. Sem pagamento: 30 dias
// grátis a partir da aprovação.
export const metadata = {
  title: "30 dias grátis: Gold ou Diamante | V3 Partners",
  description: "Cadastro da oferta única V3: escolha V3 Gold (R$ 397/mês, 25%) ou V3 Diamante (R$ 897/mês, 40%). 30 dias grátis, sem fidelidade.",
};

export default function CadastroPartnerOfertaPage() {
  return (
    <Suspense>
      <CadastroPartnerForm planosOferta={["GOLD", "DIAMANTE"]} />
    </Suspense>
  );
}

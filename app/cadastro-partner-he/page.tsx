import { Suspense } from "react";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA e SEPARADA do /cadastro-partner: link exclusivo do plano
// Partner HE (R$ 97/mês, só as 4 linhas Home Equity na Mesa de Crédito). O
// plano já vem travado — o candidato não vê nem escolhe os outros planos.
export const metadata = {
  title: "Seja Partner HE | V3 Partners",
  description:
    "Cadastro do plano Partner HE — acesso enxuto para originar Home Equity, HomeCash, Antecipação de Contratos e Crédito no Aval/Recebíveis. R$ 97/mês, sem fidelidade.",
};

export default function CadastroPartnerHePage() {
  return (
    <Suspense>
      <CadastroPartnerForm forcePlano="PARTNER_HE" />
    </Suspense>
  );
}

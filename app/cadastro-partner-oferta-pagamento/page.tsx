import { Suspense } from "react";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA: link pago da oferta (BRIEF 2026-11-13_cadastro-gold-diamante-com-pagamento).
// Igual ao /cadastro-partner-oferta (Gold ou Diamante, aceita ?plano=gold|diamante), mas sem os
// 30 dias grátis: a 1ª mensalidade é cobrada no envio pela Cora (Pix ou boleto, vencimento em 3 dias).
export const metadata = {
  title: "Cadastro V3 Gold ou Diamante | V3 Partners",
  description: "Cadastro V3 Gold (R$ 397/mês, 25%) ou V3 Diamante (R$ 897/mês, 40%): 1ª mensalidade por Pix ou boleto, sem fidelidade.",
};

export default function CadastroPartnerOfertaPagamentoPage() {
  return (
    <Suspense>
      <CadastroPartnerForm planosOferta={["GOLD", "DIAMANTE"]} ofertaPaga />
    </Suspense>
  );
}

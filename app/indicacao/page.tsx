import { Suspense } from "react";
import { IndicacaoForm } from "./indicacao-form";

export const metadata = {
  title: "Seja um Partner V3 | V3 Partners",
  description: "Preencha seus dados e entraremos em contato para apresentar a plataforma V3 Partners.",
};

export default function IndicacaoPage() {
  return (
    <Suspense fallback={null}>
      <IndicacaoForm />
    </Suspense>
  );
}

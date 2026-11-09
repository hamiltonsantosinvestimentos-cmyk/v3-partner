import { Suspense } from "react";
import type { Metadata } from "next";
import { CadastroPartnerForm } from "@/components/cadastro-partner/cadastro-form";

// Página PÚBLICA e SEPARADA do /cadastro-partner: link exclusivo do plano V3 Enterprise (white label,
// 10 acessos). O plano já vem travado: o candidato não vê nem escolhe os outros planos.
// BRIEF: docs/briefs/2026-11-09_cadastro-partner-enterprise.md. Fora das buscas (link enviado pela V3).
export const metadata: Metadata = {
  title: "V3 Enterprise | V3 Partners",
  description:
    "Cadastro do plano V3 Enterprise: acesso total à plataforma, white label e co-branding completo, 55% de comissionamento por deal originado.",
  robots: "noindex, nofollow",
};

export default function CadastroPartnerEnterprisePage() {
  return (
    <Suspense>
      <CadastroPartnerForm forcePlano="ENTERPRISE" />
    </Suspense>
  );
}

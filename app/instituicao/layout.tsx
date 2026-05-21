import type { Metadata } from "next";
import { InstituicaoChatProvider } from "@/components/instituicao/chat-provider";

export const metadata: Metadata = {
  title: "Portal Instituição — V3 Partners",
  description: "Acompanhe as propostas encaminhadas para análise de crédito.",
};

export default function InstituicaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09081A] font-sans">
      {children}
      <InstituicaoChatProvider />
    </div>
  );
}

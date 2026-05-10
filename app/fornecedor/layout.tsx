import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Fornecedor — V3 Partners Marketplace",
  description: "Cadastre seus produtos e serviços no Marketplace V3 Partners",
};

export default function FornecedorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09081A] font-sans">
      {children}
    </div>
  );
}

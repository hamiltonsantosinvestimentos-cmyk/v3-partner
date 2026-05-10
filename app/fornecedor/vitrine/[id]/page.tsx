import { Suspense } from "react";
import { SupplierVitrineClient } from "@/components/marketplace/supplier-vitrine-client";
import { Loader2 } from "lucide-react";

export default async function SupplierVitrinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#09081A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    }>
      <SupplierVitrineClient supplierId={id} />
    </Suspense>
  );
}

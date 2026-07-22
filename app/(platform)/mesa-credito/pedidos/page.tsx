import { PedidosPartnersClient } from "@/components/mesa-credito/pedidos-partners-client";

export const dynamic = "force-dynamic";

export default async function PedidosPartnersPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  const role = profile?.role ?? "PARTNER";

  const allowed = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Acesso restrito à Mesa de Crédito.</p>
      </div>
    );
  }

  return <PedidosPartnersClient />;
}

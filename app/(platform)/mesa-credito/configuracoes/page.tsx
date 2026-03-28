import { PipefyCreditoConfig } from "@/components/mesa-credito/pipefy-credito-config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function MesaCreditoConfigPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  let userRole = "PARTNER";
  if (session) {
    try { userRole = JSON.parse(session).role ?? "PARTNER"; } catch {}
  }
  if (userRole !== "ADMIN" && userRole !== "GESTAO") redirect("/mesa-credito/nivel-1");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Mesa de Crédito — Integração Pipefy</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure a sincronização dos três níveis da Mesa de Crédito com o Pipefy
        </p>
      </div>
      <PipefyCreditoConfig />
    </div>
  );
}

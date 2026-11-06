import { EnviosInstituicoesClient } from "@/components/mesa-operacional/envios-instituicoes-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// E-mails enviados às instituições (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
export default async function EnviosInstituicoesPage() {
  await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  return <EnviosInstituicoesClient />;
}

import { RelatorioMensalView } from "@/components/mesa-credito/relatorio-mensal-view";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ mes?: string }> }

export default async function RelatorioMensalPage({ searchParams }: Props) {
  // Gate no servidor (26/09/2026): a página nasceu no PR #186 sem requireRole e o
  // access-audit do CI a reprovou. Mesmos papéis da Mesa Operacional no sidebar.
  await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  const { mes } = await searchParams;
  return <RelatorioMensalView mes={mes} basePath="/mesa-operacional/relatorio-mensal" somenteEquipe />;
}

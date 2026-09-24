import { RelatorioMensalView } from "@/components/mesa-credito/relatorio-mensal-view";

export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ mes?: string }> }

export default async function RelatorioMensalPage({ searchParams }: Props) {
  const { mes } = await searchParams;
  return <RelatorioMensalView mes={mes} basePath="/mesa-operacional/relatorio-mensal" somenteEquipe />;
}

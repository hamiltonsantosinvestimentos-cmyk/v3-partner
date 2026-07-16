import { IntermediaryFillViewer } from "@/components/cm/intermediary-fill-viewer";

export const metadata = { title: "Cadeia de Intermediários — V3 Partners" };

export default async function PreencherIntermediariosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <IntermediaryFillViewer token={token} />;
}

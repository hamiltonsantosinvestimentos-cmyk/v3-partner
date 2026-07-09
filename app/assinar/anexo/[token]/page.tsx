import { AnnexSignViewer } from "@/components/cm/annex-sign-viewer";

export const metadata = { title: "Assinatura de Anexo — V3 Partners" };

export default async function AssinarAnexoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AnnexSignViewer token={token} />;
}

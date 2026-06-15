import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { resolveIntakeSchema } from "@/lib/ma/bp-intake/engine/schema-registry";
import { ObserverViewer } from "@/components/ma/bp-intake/observer-viewer";

export const metadata: Metadata = {
  title: "Observador — V3 Partners",
  description: "Acompanhamento de dados submetidos para estruturação de Business Plan.",
  robots: "noindex, nofollow",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

const C = { nd: "#09081A", cr: "#F5F1E8", mu: "#9BAFC5" };

export default async function ObservadorPage({ params }: PageProps) {
  const { token } = await params;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: deal } = await sb
    .from("ma_deals")
    .select("id, sector, title, contract_status, asset_data")
    .contains("asset_data", { bp_observer_token: token })
    .single();

  if (!deal) {
    return <InfoPage message="Link inválido." />;
  }

  if (deal.contract_status !== "SIGNED") {
    return (
      <InfoPage message="Acesso de observador será liberado após a formalização do contrato com a V3 Partners." />
    );
  }

  const assetData = deal.asset_data as Record<string, unknown>;
  const subSector = (assetData.sub_sector as string | undefined) ?? undefined;
  const schema = resolveIntakeSchema(deal.sector, subSector);

  return (
    <ObserverViewer
      dealTitle={deal.title}
      schema={schema}
      intakeResponses={assetData.intake_responses as Record<string, unknown> | null}
      financialProjections={assetData.financial_projections as Record<string, unknown> | null}
      submittedAt={assetData.intake_submitted_at as string | undefined}
    />
  );
}

function InfoPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: C.nd }}>
      <div className="max-w-sm w-full text-center space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-10 w-auto mx-auto" />
        <p className="text-sm" style={{ color: C.mu }}>{message}</p>
      </div>
    </div>
  );
}

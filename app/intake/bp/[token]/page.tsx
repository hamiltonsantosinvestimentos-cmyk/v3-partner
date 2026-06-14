import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { IntakeFormRenderer } from "@/components/ma/bp-intake/form-renderer";
import { resolveIntakeSchema } from "@/lib/ma/bp-intake/engine/schema-registry";
import { fetchFxRate } from "@/lib/ma/bp-intake/engine/fx-service";

export const metadata: Metadata = {
  title: "Captação de KPIs — V3 Partners",
  description: "Formulário de captação de dados para estruturação de Business Plan.",
  robots: "noindex, nofollow",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function BpIntakePage({ params }: PageProps) {
  const { token } = await params;

  // Resolve token directly via service-role client (no HTTP self-request)
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: deal } = await sb
    .from("ma_deals")
    .select("id, sector, asset_data, title")
    .contains("asset_data", { bp_intake_token: token })
    .single();

  if (!deal) {
    return <IntakeErrorPage message="Link inválido ou expirado." />;
  }

  const assetData = deal.asset_data as Record<string, unknown>;
  const expiresAt = assetData.bp_intake_expires_at as string | undefined;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return <IntakeErrorPage message="Este link expirou. Solicite um novo à equipe V3 Partners." />;
  }

  const subSector = (assetData.sub_sector as string | undefined) ?? undefined;
  const schema = resolveIntakeSchema(deal.sector, subSector);
  const fx = await fetchFxRate();

  return (
    <IntakeFormRenderer
      token={token}
      schema={schema}
      fxSnapshot={fx}
      expiresAt={expiresAt}
    />
  );
}

function IntakeErrorPage({ message }: { message: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#09081A" }}
    >
      <div className="max-w-sm w-full text-center space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/v3-logo-flat-gold-alpha.png"
          alt="V3 Partners"
          className="h-10 w-auto mx-auto"
        />
        <p className="text-sm" style={{ color: "#9BAFC5" }}>{message}</p>
        <p className="text-[10px]" style={{ color: "#9BAFC5" }}>
          Solicite um novo link à equipe V3 Partners.
        </p>
      </div>
    </div>
  );
}

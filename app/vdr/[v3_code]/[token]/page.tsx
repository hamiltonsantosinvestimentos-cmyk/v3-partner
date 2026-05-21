/**
 * Página pública do VDR (Virtual Data Room)
 * URL: /vdr/V3-2026-05-REA-001/{token}?grp=btg-pactual&side=buyer
 *
 * Sem auth Supabase — acesso via token único por convite.
 * Layout separado do portal interno (sem sidebar, navbar V3 simplificada).
 */

import { VdrClient } from "@/components/investor/vdr-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ v3_code: string; token: string }>;
};

export default async function VdrPage({ params }: PageProps) {
  const { v3_code, token } = await params;

  return (
    <VdrClient
      v3Code={v3_code}
      token={token}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { v3_code } = await params;
  return {
    title: `V3 Partners · Deal Room ${v3_code}`,
    description: "Acesso restrito a documentos de investimento. Requer NDA.",
    robots: "noindex, nofollow",
  };
}

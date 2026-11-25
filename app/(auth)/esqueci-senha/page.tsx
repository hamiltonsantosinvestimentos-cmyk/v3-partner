import type { Metadata } from "next";
import { headers } from "next/headers";
import { marcaDoHost, metadataDaMarca } from "@/lib/enterprise-marca-host";
import { dominioComMarcaPronta, servico } from "@/lib/recuperar-senha";
import { EsqueciSenhaClient } from "./esqueci-senha-client";

// Domínio próprio de Enterprise: marca resolvida no servidor (BRIEF
// docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md). Com o domínio ativo e verificado
// no Resend, a recuperação sai pela plataforma com a marca
// (BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md).
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl } = await marcaDoHost();
  return metadataDaMarca(marca, iconeUrl);
}

export default async function EsqueciSenhaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { marca, temaCss } = await marcaDoHost();
  const { erro } = await searchParams;
  let recuperacaoPelaMarca = false;
  if (marca) {
    const h = await headers();
    recuperacaoPelaMarca = !!(await dominioComMarcaPronta(servico(), h.get("x-forwarded-host") ?? h.get("host")));
  }
  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <EsqueciSenhaClient marca={marca} recuperacaoPelaMarca={recuperacaoPelaMarca} linkVencido={erro === "link"} />
    </>
  );
}

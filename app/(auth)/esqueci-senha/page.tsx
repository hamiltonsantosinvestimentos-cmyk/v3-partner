import type { Metadata } from "next";
import { marcaDoHost } from "@/lib/enterprise-marca-host";
import { EsqueciSenhaClient } from "./esqueci-senha-client";

// Domínio próprio de Enterprise: marca resolvida no servidor (BRIEF
// docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md).
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl } = await marcaDoHost();
  if (!marca) return {};
  return { title: marca.nome, ...(iconeUrl ? { icons: { icon: iconeUrl } } : {}) };
}

export default async function EsqueciSenhaPage() {
  const { marca, temaCss } = await marcaDoHost();
  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <EsqueciSenhaClient marca={marca} />
    </>
  );
}

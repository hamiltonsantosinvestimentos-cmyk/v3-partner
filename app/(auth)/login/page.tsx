import type { Metadata } from "next";
import { marcaDoHost } from "@/lib/enterprise-marca-host";
import { LoginClient } from "./login-client";

// Domínio próprio de Enterprise: a marca é resolvida no servidor, então a tela já abre com
// logo, nome e cores dele (BRIEF docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md).
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl } = await marcaDoHost();
  if (!marca) return {};
  return { title: marca.nome, ...(iconeUrl ? { icons: { icon: iconeUrl } } : {}) };
}

export default async function LoginPage() {
  const { marca, temaCss } = await marcaDoHost();
  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <LoginClient marca={marca} />
    </>
  );
}

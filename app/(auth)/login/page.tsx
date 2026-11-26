import type { Metadata } from "next";
import { marcaDoHost, metadataDaMarca, viewportDoHost } from "@/lib/enterprise-marca-host";
import { LoginClient } from "./login-client";

// Domínio próprio de Enterprise: a marca é resolvida no servidor, então a tela já abre com
// logo, nome e cores dele (BRIEF docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md).
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl, versao } = await marcaDoHost();
  return metadataDaMarca(marca, iconeUrl, versao);
}

// Cor da barra e do app instalado no domínio do Enterprise (BRIEF 2026-11-26_app-instalado-marca-enterprise).
export const generateViewport = viewportDoHost;

export default async function LoginPage() {
  const { marca, temaCss } = await marcaDoHost();
  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <LoginClient marca={marca} />
    </>
  );
}

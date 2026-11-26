import type { Metadata } from "next";
import { marcaDoHost, metadataDaMarca, viewportDoHost } from "@/lib/enterprise-marca-host";
import { UpdatePasswordClient } from "./update-password-client";

// Nova senha com a marca do domínio acessado (BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md).
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl, versao } = await marcaDoHost();
  return metadataDaMarca(marca, iconeUrl, versao);
}

// Cor da barra e do app instalado no domínio do Enterprise (BRIEF 2026-11-26_app-instalado-marca-enterprise).
export const generateViewport = viewportDoHost;

export default async function UpdatePasswordPage() {
  const { marca, temaCss } = await marcaDoHost();
  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <UpdatePasswordClient marca={marca} />
    </>
  );
}

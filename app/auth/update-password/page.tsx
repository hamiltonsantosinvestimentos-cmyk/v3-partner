import type { Metadata } from "next";
import { marcaDoHost, metadataDaMarca } from "@/lib/enterprise-marca-host";
import { UpdatePasswordClient } from "./update-password-client";

// Nova senha com a marca do domínio acessado (BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md).
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl } = await marcaDoHost();
  return metadataDaMarca(marca, iconeUrl);
}

export default async function UpdatePasswordPage() {
  const { marca, temaCss } = await marcaDoHost();
  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <UpdatePasswordClient marca={marca} />
    </>
  );
}

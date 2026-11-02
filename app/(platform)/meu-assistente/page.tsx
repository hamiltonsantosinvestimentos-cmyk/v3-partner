import { redirect } from "next/navigation";
import { exigirUsuarioAutorizado } from "@/lib/assistente/acesso";
import { garantirConfig, svcAssistente } from "@/lib/assistente/conexao";
import { MeuAssistenteClient } from "@/components/meu-assistente/meu-assistente-client";

export const dynamic = "force-dynamic";

export default async function MeuAssistentePage() {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) redirect("/unauthorized");
  // A linha em assistente_config é o que libera as políticas do banco para Finanças e Agenda.
  await garantirConfig(svcAssistente(), auth.user.id);
  return <MeuAssistenteClient />;
}

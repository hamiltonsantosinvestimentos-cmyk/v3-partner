// Contatos desligados da V3 (20/10/2026, pedido de João: "corrija em definitivo esse erro").
// O e-mail do Dr. Luis Athaydes, que saiu do time em 29/09/2026, continuou na cláusula 7.1 de
// duas minutas aprovadas e chegou a contratos gerados (V3C-NDA-2026-0056 e 0057). Esta lista é a
// fonte única: minuta que cita alguém daqui não vai para revisão nem é aprovada, e contrato que
// cita não é gerado nem enviado para assinatura. Para desligar alguém, acrescentar aqui.
export const REVOKED_CONTACTS: ReadonlyArray<{ email: string; nome: string; desde: string }> = [
  { email: "luis.athaydes@v3partners.com.br", nome: "Dr. Luis Athaydes", desde: "29/09/2026" },
];

/** Contatos desligados citados no texto (comparação sem diferenciar maiúsculas). */
export function findRevokedContacts(text: string | null | undefined): string[] {
  const t = String(text ?? "").toLowerCase();
  return REVOKED_CONTACTS.filter((c) => t.includes(c.email)).map((c) => `${c.nome} (${c.email}, fora da V3 desde ${c.desde})`);
}

/** Mensagem de bloqueio (422) ou null quando o texto não cita ninguém desligado. */
export function revokedContactsError(text: string | null | undefined, alvo: "minuta" | "contrato"): string | null {
  const found = findRevokedContacts(text);
  if (!found.length) return null;
  return alvo === "minuta"
    ? `A minuta cita contato que não faz mais parte da V3: ${found.join("; ")}. Troque no texto (ex.: Jurídico V3 Partners, juridico@v3partners.com.br) antes de seguir.`
    : `O contrato cita contato que não faz mais parte da V3: ${found.join("; ")}. Corrija a minuta de origem e gere o contrato de novo, ou ajuste este rascunho antes do envio.`;
}

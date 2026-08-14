export type QuickReplyOption = {
  key: string;
  label: string;
};

const NUMBER_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

export function formatQuickReplyBlock(options: QuickReplyOption[]): string {
  const linhas = options.map((opt, i) => `${NUMBER_EMOJI[i] ?? `${opt.key}.`} ${opt.label}`);
  return `Digite o número da opção:\n${linhas.join("\n")}`;
}

// Normaliza a resposta do lead ("1", "1️⃣", "1.", " 1 ") e casa contra as opções
// oferecidas na última mensagem do assistente. Retorna null se não houver match.
export function resolveQuickReply(messageText: string, options: QuickReplyOption[]): QuickReplyOption | null {
  if (!options?.length) return null;

  const normalizado = messageText
    .trim()
    .replace(/[\uFE0F\u20E3]/g, "") // remove variation selector e combining enclosing keycap
    .replace(/\.$/, "");

  return options.find(opt => opt.key === normalizado) ?? null;
}

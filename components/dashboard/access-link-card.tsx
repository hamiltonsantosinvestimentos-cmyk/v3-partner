"use client";

import { useEffect, useState } from "react";
import { Link2, Check, MessageCircle } from "lucide-react";

// Card do dashboard do partner V3 Access (papel STARTER): o link fixo da Análise Estruturada
// V3 para mandar ao cliente. Não precisa de proposta antes: quando o cliente paga, a proposta
// nasce sozinha na Mesa de Crédito (lib/analise-estruturada/proposta-automatica.ts).

export function AccessLinkCard() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => setPartnerId(d?.profile?.id ?? null)).catch(() => {});
  }, []);

  if (!partnerId) return null;
  const link = `https://app.v3partners.com.br/analise/checkout?pacote=access&ref=${partnerId}`;
  const mensagem =
    "Olá! Segue o link da Análise Estruturada V3: um parecer completo da sua capacidade de pagamento, rating e plano para acessar crédito. " +
    `Você escolhe CPF ou CNPJ, informa os sócios e conclui o pagamento: ${link}`;

  function copiar() {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-[#C9A84C]/40 bg-gradient-to-br from-[#C9A84C]/10 to-transparent p-5 space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#E8C97A]">Análise Estruturada V3 · seu link</p>
        <h3 className="text-base font-bold text-white mt-1">Envie para o seu cliente</h3>
        <p className="text-xs text-muted-foreground mt-1">
          O cliente escolhe CPF ou CNPJ, informa os sócios e paga <strong className="text-foreground">R$ 1.500</strong>.
          Depois do pagamento, a proposta aparece automaticamente na sua Mesa de Crédito, com código.
          Você recebe <strong className="text-[#E8C97A]">R$ 500</strong> quando o parecer for entregue.
        </p>
      </div>
      <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground break-all font-mono">{link}</div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={copiar}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold">
          {copiado ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {copiado ? "Link copiado!" : "Copiar link"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#C9A84C] text-[#E8C97A] text-xs font-bold">
          <MessageCircle className="w-3.5 h-3.5" /> Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}

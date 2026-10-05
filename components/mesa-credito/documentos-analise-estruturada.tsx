"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Clock } from "lucide-react";

// Painel "Documentos da Análise Estruturada" no detalhe do pedido (Mesa). Só aparece
// em pedido do pacote V3 Access; para os demais a API responde ativo=false.

interface Arquivo { nome: string; enviado_em: string | null; url: string | null }
interface Item { key: string; label: string; obrigatorio: boolean; arquivos: Arquivo[] }
interface Resposta {
  ativo: boolean;
  completo?: boolean;
  completo_em?: string | null;
  prazo_entrega?: string | null;
  obrigatorios_faltando?: number;
  itens?: Item[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function DocumentosAnaliseEstruturada({ orderId }: { orderId: string }) {
  const [dados, setDados] = useState<Resposta | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/analise-estruturada/pedido/${orderId}`)
      .then((r) => r.json())
      .then((d: Resposta) => { if (!cancelado) setDados(d); })
      .catch(() => { if (!cancelado) setDados({ ativo: false }); });
    return () => { cancelado = true; };
  }, [orderId]);

  if (!dados?.ativo) return null;
  const atrasado = dados.prazo_entrega ? new Date(dados.prazo_entrega).getTime() < Date.now() : false;

  return (
    <div className="rounded-xl border border-[#C9A84C]/30 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Análise Estruturada V3 · documentos do cliente</p>
          <p className="text-sm font-semibold text-foreground">
            {dados.completo
              ? "Obrigatórios completos"
              : `Faltam ${dados.obrigatorios_faltando} obrigatório${dados.obrigatorios_faltando === 1 ? "" : "s"}`}
          </p>
        </div>
        {dados.prazo_entrega && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${atrasado ? "text-red-400" : "text-[#E8C97A]"}`}>
            <Clock className="w-3.5 h-3.5" />
            {atrasado ? "Prazo vencido em " : "Entregar até "}{fmt(dados.prazo_entrega)}
          </div>
        )}
      </div>
      {dados.completo_em && (
        <p className="text-[11px] text-muted-foreground">Documentos completos em {fmt(dados.completo_em)} (início do prazo de 24h).</p>
      )}
      <div className="space-y-2">
        {(dados.itens ?? []).map((item) => (
          <div key={item.key} className="rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              {item.arquivos.length > 0
                ? <CheckCircle2 className="w-4 h-4 text-[#C9A84C] shrink-0" />
                : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="text-foreground font-medium">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.obrigatorio ? "obrigatório" : "opcional"}</span>
            </div>
            {item.arquivos.length > 0 && (
              <ul className="mt-2 space-y-1 pl-6">
                {item.arquivos.map((a, i) => (
                  <li key={i} className="text-xs flex items-center gap-2">
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[#E8C97A] hover:underline inline-flex items-center gap-1 truncate">
                        {a.nome} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : <span className="text-muted-foreground truncate">{a.nome}</span>}
                    {a.enviado_em && <span className="text-muted-foreground shrink-0">· {fmt(a.enviado_em)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

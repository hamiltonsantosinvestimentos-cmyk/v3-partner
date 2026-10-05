"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Envio de documentos da Análise Estruturada V3 (pacote Access, MELHORIA DA CONSULTA
// Fase 1). Aparece no intake depois do consentimento; para qualquer outro pedido a
// API responde ativo=false e nada é exibido.

interface Arquivo { nome: string; enviado_em: string | null }
interface Item { key: string; label: string; descricao: string; obrigatorio: boolean; arquivos: Arquivo[] }
interface Status {
  ativo: boolean;
  consentido?: boolean;
  itens?: Item[];
  obrigatorios_faltando?: number;
  completo?: boolean;
  completo_em?: string | null;
  prazo_entrega?: string | null;
  error?: string;
}

const C = { gold: "#C9A84C", goldLight: "#E8C97A", cream: "#F5F1E8", muted: "#9BAFC5", card: "#111F35", line: "rgba(155,175,197,.2)" };
const ACEITOS = ".pdf,.ofx,.csv,.txt,.xml,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png";

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function useStatusDocumentosAnalise(token: string) {
  const [status, setStatus] = useState<Status | null>(null);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/analise-estruturada/${token}/documentos`);
      setStatus((await r.json()) as Status);
    } catch {
      setStatus({ ativo: false });
    }
  }, [token]);
  useEffect(() => { carregar(); }, [carregar]);
  return { status, setStatus, carregar };
}

export function DocumentosAnalise({ token, status, setStatus }: { token: string; status: Status; setStatus: (s: Status) => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function enviar(key: string, files: FileList | null) {
    if (!files?.length) return;
    setErro("");
    setEnviando(key);
    try {
      for (const file of Array.from(files)) {
        const r = await fetch(`/api/analise-estruturada/${token}/documentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "url", key, nome_arquivo: file.name }),
        });
        const d = await r.json() as { url?: string; content_type?: string; error?: string };
        if (!r.ok || !d.url) throw new Error(d.error ?? "Falha ao preparar o envio.");
        const put = await fetch(d.url, { method: "PUT", headers: { "Content-Type": d.content_type ?? "application/octet-stream" }, body: file });
        if (!put.ok) throw new Error(`Falha ao enviar ${file.name}. Tente de novo.`);
      }
      const r = await fetch(`/api/analise-estruturada/${token}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "confirmar" }),
      });
      const d = await r.json() as Status;
      if (!r.ok) throw new Error(d.error ?? "Falha ao registrar o envio.");
      setStatus(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setEnviando(null);
      const el = inputs.current[key];
      if (el) el.value = "";
    }
  }

  const itens = status.itens ?? [];
  const faltando = status.obrigatorios_faltando ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.goldLight }}>Análise Estruturada V3</p>
        <h1 className="text-lg font-bold" style={{ color: C.cream }}>Envie seus documentos</h1>
        <p className="text-sm mt-2" style={{ color: C.muted }}>
          Com eles calculamos a sua capacidade de pagamento, o seu rating e o plano para você chegar ao crédito.
          Os itens marcados como obrigatórios são necessários para emitirmos o parecer.
        </p>
      </div>

      {status.completo ? (
        <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(201,168,76,.1)", border: `1px solid ${C.gold}`, color: C.cream }}>
          Recebemos todos os documentos obrigatórios.
          {status.prazo_entrega ? <> Seu parecer fica pronto até <strong>{fmtDataHora(status.prazo_entrega)}</strong>.</> : null}
          {" "}Se tiver os itens opcionais, envie também: eles deixam a análise mais precisa.
        </div>
      ) : (
        <p className="text-xs" style={{ color: C.goldLight }}>
          Faltam {faltando} documento{faltando === 1 ? "" : "s"} obrigatório{faltando === 1 ? "" : "s"}.
        </p>
      )}

      <div className="space-y-3">
        {itens.map((item) => {
          const ok = item.arquivos.length > 0;
          return (
            <div key={item.key} className="rounded-lg p-3 space-y-2" style={{ background: C.card, border: `1px solid ${ok ? "rgba(201,168,76,.45)" : C.line}` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.cream }}>
                    {ok ? "✓ " : ""}{item.label}
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: item.obrigatorio ? C.goldLight : C.muted }}>
                      {item.obrigatorio ? "Obrigatório" : "Opcional"}
                    </span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: C.muted }}>{item.descricao}</p>
                </div>
                <button
                  type="button"
                  disabled={enviando !== null}
                  onClick={() => inputs.current[item.key]?.click()}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                  style={{ background: ok ? "transparent" : C.gold, color: ok ? C.goldLight : "#09081A", border: `1px solid ${C.gold}` }}
                >
                  {enviando === item.key ? "Enviando…" : ok ? "Adicionar" : "Enviar"}
                </button>
                <input
                  ref={(el) => { inputs.current[item.key] = el; }}
                  type="file"
                  multiple
                  accept={ACEITOS}
                  className="hidden"
                  onChange={(e) => enviar(item.key, e.target.files)}
                />
              </div>
              {ok && (
                <ul className="space-y-1">
                  {item.arquivos.map((a, i) => (
                    <li key={i} className="text-xs truncate" style={{ color: C.muted }}>{a.nome}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {erro && <p className="text-xs" style={{ color: "#F59E0B" }}>{erro}</p>}
      <p className="text-[11px]" style={{ color: C.muted }}>
        Aceitamos PDF, OFX, CSV, planilhas, Word e imagens. Seus documentos ficam guardados com segurança e só a equipe de análise da V3 tem acesso.
      </p>
    </div>
  );
}

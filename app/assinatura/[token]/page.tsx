"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

// Página pública do cliente: baixar o documento, assinar e devolver o arquivo assinado.
// Link enviado por e-mail pelo partner/Mesa (lib/documentos-assinatura.ts).

type Info = {
  titulo: string; orientacao: string | null; cliente: string | null; codigo: string | null;
  original_nome: string; originais?: string[]; assinados?: string[];
  ja_enviado: boolean; assinado_nome: string | null; expira_em: string;
  marca: { nome: string; logoUrl: string | null } | null;
};

const C = { navy: "#09081A", card: "#162744", borda: "#243A66", ouro: "#C9A84C", cream: "#F0ECE4", muted: "#9BAFC5" };

export default function AssinaturaPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/public/assinatura/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) setErro(j.error ?? "Link inválido.");
        else { setInfo(j); setEnviado(Boolean(j.ja_enviado)); }
      })
      .catch(() => setErro("Não foi possível abrir o link. Verifique sua internet."));
  }, [token]);

  async function enviar() {
    if (arquivos.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      for (const f of arquivos) fd.append("file", f);
      const r = await fetch(`/api/public/assinatura/${token}`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErro(j.error ?? "Falha ao enviar."); return; }
      setEnviado(true);
      setInfo((i) => (i ? { ...i, assinados: [...(i.assinados ?? []), ...arquivos.map((f) => f.name)] } : i));
      setArquivos([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const passo = (n: number, titulo: string, children: React.ReactNode, feito = false) => (
    <div style={{ display: "flex", gap: 14, padding: "16px 0", borderTop: `1px solid ${C.borda}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, background: feito ? "#10B98133" : `${C.ouro}22`, color: feito ? "#34D399" : C.ouro }}>
        {feito ? "✓" : n}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "3px 0 8px", color: C.cream, fontWeight: 700, fontSize: 14 }}>{titulo}</p>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: "'DM Sans', Arial, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info?.marca?.logoUrl ?? "/v3-logo-flat-gold-alpha.png"} alt={info?.marca?.nome ?? "V3 Partners"} style={{ height: 40, width: "auto" }} />
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.borda}`, borderRadius: 14, padding: 26 }}>
          {!info && !erro && <p style={{ color: C.muted, textAlign: "center", fontSize: 14 }}>Carregando…</p>}
          {!info && erro && <p style={{ color: C.cream, textAlign: "center", fontSize: 14 }}>{erro}</p>}

          {info && (
            <>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.ouro }}>Documento para assinatura</p>
              <h1 style={{ margin: "6px 0 4px", color: C.cream, fontSize: 20 }}>{info.titulo}</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
                {info.cliente ? `Para ${info.cliente}` : ""}{info.codigo ? ` · proposta ${info.codigo}` : ""}
              </p>

              {info.orientacao && (
                <div style={{ margin: "18px 0 4px", padding: "12px 14px", background: "#13223A", borderLeft: `3px solid ${C.ouro}`, borderRadius: 8, color: C.cream, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                  {info.orientacao}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                {passo(1, (info.originais?.length ?? 1) > 1 ? `Baixe os ${info.originais!.length} documentos` : "Baixe o documento", (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                    {(info.originais?.length ? info.originais : [info.original_nome]).map((nome, i) => (
                      <a key={i} href={`/api/public/assinatura/${token}?baixar=${i + 1}`} style={{ display: "inline-block", background: C.ouro, color: C.navy, fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 8, textDecoration: "none" }}>
                        Baixar {nome}
                      </a>
                    ))}
                  </div>
                ))}
                {passo(2, "Assine", (
                  <p style={{ margin: 0, color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
                    Pode ser assinatura digital (por exemplo, gov.br) ou impresso, assinado à mão e digitalizado/fotografado com boa qualidade, todas as páginas legíveis.
                  </p>
                ))}
                {passo(3, "Envie o(s) arquivo(s) assinado(s)", enviado ? (
                  <p style={{ margin: 0, color: "#34D399", fontSize: 13 }}>
                    Recebemos {(info.assinados?.length ?? 1) > 1 ? `${info.assinados!.length} arquivos` : "o arquivo"}: {(info.assinados?.length ? info.assinados : [info.assinado_nome ?? ""]).join(", ")}. Obrigado! Se faltou algo, envie mais abaixo.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>PDF, JPG ou PNG, até 20MB cada. Pode escolher vários (ex.: uma foto por página).</p>
                ), enviado)}
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: 42 }}>
                  <input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} style={{ color: C.muted, fontSize: 12, maxWidth: "100%" }} />
                  <button onClick={enviar} disabled={arquivos.length === 0 || enviando} style={{ background: arquivos.length ? C.ouro : "#243A66", color: arquivos.length ? C.navy : C.muted, border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: arquivos.length ? "pointer" : "default" }}>
                    {enviando ? "Enviando…" : arquivos.length > 1 ? `Enviar ${arquivos.length} arquivos` : enviado ? "Enviar mais" : "Enviar assinado"}
                  </button>
                </div>
                {erro && <p style={{ color: "#F59E0B", fontSize: 12, marginLeft: 42 }}>{erro}</p>}
              </div>

              <p style={{ marginTop: 22, color: C.muted, fontSize: 11 }}>
                Link válido até {new Date(info.expira_em).toLocaleDateString("pt-BR")}.
              </p>
            </>
          )}
        </div>
        <p style={{ textAlign: "center", color: "#3A5068", fontSize: 10, marginTop: 16 }}>
          {info?.marca ? `${info.marca.nome} · Powered by V3 Partners` : "V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50"}
        </p>
      </div>
    </div>
  );
}

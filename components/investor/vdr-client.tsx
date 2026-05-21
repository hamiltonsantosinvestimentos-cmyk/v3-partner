"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, FileText, CheckCircle, Lock, Unlock, AlertTriangle, ExternalLink, Clock } from "lucide-react";

// ─── Paleta V3 ────────────────────────────────────────────────────────────────
const V3 = {
  gold: "#C9A84C", goldLt: "#E8C97A",
  navy: "#09081A", navyMid: "#162744", navyBrd: "#243A66",
  cream: "#F0ECE4", muted: "#7A8FA8",
  green: "#4CAF7D", amber: "#E89B3A", red: "#E05555",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Document = {
  id: string; label: string; doc_type: string;
  requires_nda: boolean; locked: boolean; file_size_bytes?: number;
};

type QAThread = {
  id: string; subject: string; status: string; created_at: string;
  deal_qa_messages: Array<{ id: string; sender_type: string; content: string; is_published: boolean; created_at: string }>;
};

type RoomData = {
  room:        { id: string; name: string; nda_required: boolean; nda_text: string | null };
  deal:        { v3_code: string | null; target_company: string | null; sector: string | null };
  investor:    { name: string; company: string | null };
  nda_signed:  boolean;
  documents:   Document[];
  access_count: number;
};

type VdrState = "loading" | "error" | "nda_required" | "ready" | "expired";

// ─── Props ────────────────────────────────────────────────────────────────────
interface VdrClientProps { v3Code: string; token: string }

// ─── Component ────────────────────────────────────────────────────────────────
export function VdrClient({ v3Code, token }: VdrClientProps) {
  const [state, setState] = useState<VdrState>("loading");
  const [data, setData] = useState<RoomData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [ndaChecked, setNdaChecked] = useState([false, false, false]);
  const [signing, setSigning] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);
  const viewTimers = useRef<Record<string, { view_id: string; start: number }>>({});
  // Q&A state
  const [qaThreads, setQaThreads] = useState<QAThread[]>([]);
  const [qaSubject, setQaSubject] = useState("");
  const [qaContent, setQaContent] = useState("");
  const [qaSending, setQaSending] = useState(false);
  const [qaSuccess, setQaSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<"docs" | "qa">("docs");

  // ── Fetch room data ──
  useEffect(() => {
    fetch(`/api/investor/vdr/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setErrorMsg(d.error);
          setState("error");
          return;
        }
        setData(d);
        const isReady = d.nda_signed || !d.room.nda_required;
        setState(isReady ? "ready" : "nda_required");
        if (isReady) fetchQA();
      })
      .catch(() => { setErrorMsg("Erro de conexão. Tente novamente."); setState("error"); });
  }, [token]);

  // ── Buscar Q&A ──
  const fetchQA = async () => {
    const r = await fetch(`/api/investor/vdr/${token}/qa`);
    const d = await r.json();
    if (d.threads) setQaThreads(d.threads);
  };

  // ── Enviar pergunta ──
  const handleSendQuestion = async () => {
    if (!qaSubject.trim() || !qaContent.trim()) return;
    setQaSending(true);
    const r = await fetch(`/api/investor/vdr/${token}/qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: qaSubject, content: qaContent }),
    });
    const d = await r.json();
    if (d.thread_id) {
      setQaSubject("");
      setQaContent("");
      setQaSuccess(true);
      setTimeout(() => setQaSuccess(false), 3000);
      fetchQA();
    }
    setQaSending(false);
  };

  // ── Assinar NDA ──
  const handleSignNda = async () => {
    if (!ndaChecked.every(Boolean)) return;
    setSigning(true);
    const r = await fetch(`/api/investor/vdr/${token}/nda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: true }),
    });
    const d = await r.json();
    if (d.signed || d.already_signed) {
      setData(prev => prev ? { ...prev, nda_signed: true, documents: prev.documents.map(doc => ({ ...doc, locked: false })) } : prev);
      setState("ready");
    }
    setSigning(false);
  };

  // ── Abrir documento ──
  const handleOpenDoc = async (doc: Document) => {
    if (doc.locked) return;
    setOpeningDoc(doc.id);
    const r = await fetch(`/api/investor/vdr/${token}/document/${doc.id}`, { method: "POST" });
    const d = await r.json();
    setOpeningDoc(null);
    if (d.error) { alert(d.error); return; }

    // Registra timer para log de duração
    viewTimers.current[doc.id] = { view_id: d.view_id, start: Date.now() };
    window.open(d.url, "_blank", "noopener");

    // Log duração ao fechar tab (best-effort via visibilitychange)
    const logDuration = () => {
      const timer = viewTimers.current[doc.id];
      if (!timer) return;
      const duration = Math.round((Date.now() - timer.start) / 1000);
      fetch(`/api/investor/vdr/${token}/document/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view_id: timer.view_id, duration_seconds: duration }),
        keepalive: true,
      });
      delete viewTimers.current[doc.id];
    };
    document.addEventListener("visibilitychange", logDuration, { once: true });
  };

  const allChecked = ndaChecked.every(Boolean);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: V3.navy, fontFamily: "'DM Sans', sans-serif", color: V3.cream }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${V3.navyBrd}`, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="V3 Partners" style={{ height: 36 }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: V3.muted, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Deal Room</div>
          <div style={{ fontSize: 13, color: V3.gold, fontWeight: 700 }}>{v3Code}</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>

        {/* Loading */}
        {state === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", color: V3.muted }}>
            <Shield style={{ width: 40, height: 40, color: V3.gold, margin: "0 auto 16px", display: "block" }} />
            <p>Verificando credenciais de acesso...</p>
          </div>
        )}

        {/* Error / Expired */}
        {state === "error" && (
          <div style={{ background: `${V3.red}12`, border: `1px solid ${V3.red}30`, borderRadius: 12, padding: 32, textAlign: "center" }}>
            <AlertTriangle style={{ width: 40, height: 40, color: V3.red, margin: "0 auto 16px", display: "block" }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: V3.cream, marginBottom: 8 }}>Acesso Indisponível</h2>
            <p style={{ color: V3.muted, fontSize: 14 }}>{errorMsg}</p>
            <p style={{ color: V3.muted, fontSize: 12, marginTop: 16 }}>Solicite um novo link ao consultor V3 Partners.</p>
          </div>
        )}

        {/* NDA Gate */}
        {state === "nda_required" && data && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <Shield style={{ width: 40, height: 40, color: V3.gold, margin: "0 auto 12px", display: "block" }} />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: V3.cream, marginBottom: 4 }}>Acordo de Confidencialidade</h1>
              <p style={{ color: V3.muted, fontSize: 13 }}>Leia e aceite os termos para acessar os documentos de {data.deal.target_company ?? "investimento"}.</p>
            </div>

            {/* NDA text */}
            <div style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}`, borderRadius: 12, padding: 20, marginBottom: 24, maxHeight: 280, overflowY: "auto" }}>
              <pre style={{ fontSize: 11, color: V3.muted, whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit" }}>
                {data.room.nda_text}
              </pre>
            </div>

            {/* Checkboxes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                "Li e aceito integralmente o Acordo de Confidencialidade acima, reconhecendo sua validade jurídica.",
                "Estou ciente de que meu endereço IP e o horário deste aceite serão registrados como evidência eletrônica.",
                "Confirmo que não divulgarei as informações deste Deal Room a terceiros sem autorização da V3 Partners.",
              ].map((text, i) => (
                <label key={i} style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "flex-start" }}>
                  <div onClick={() => setNdaChecked(prev => { const n=[...prev]; n[i]=!n[i]; return n; })}
                    style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${ndaChecked[i] ? V3.gold : V3.navyBrd}`, background: ndaChecked[i] ? `${V3.gold}20` : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, cursor: "pointer", transition: "all 0.15s" }}>
                    {ndaChecked[i] && <CheckCircle style={{ width: 12, height: 12, color: V3.gold }} />}
                  </div>
                  <span style={{ fontSize: 13, color: V3.muted, lineHeight: 1.5 }}>{text}</span>
                </label>
              ))}
            </div>

            <button onClick={handleSignNda} disabled={!allChecked || signing}
              style={{ width: "100%", padding: "14px 0", borderRadius: 10, border: "none", cursor: allChecked ? "pointer" : "not-allowed", background: allChecked ? V3.gold : V3.navyBrd, color: allChecked ? V3.navy : V3.muted, fontWeight: 700, fontSize: 15, fontFamily: "inherit", transition: "all 0.2s" }}>
              {signing ? "Registrando aceite..." : "Aceitar e Acessar Documentos →"}
            </button>

            <p style={{ textAlign: "center", fontSize: 11, color: V3.muted, marginTop: 12, lineHeight: 1.5 }}>
              Ao aceitar, sua assinatura eletrônica será registrada com IP, data e hora.<br />
              Canal LGPD: privacidade@v3partners.com.br
            </p>
          </div>
        )}

        {/* Ready — lista de documentos */}
        {state === "ready" && data && (
          <div>
            {/* Boas-vindas */}
            <div style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <CheckCircle style={{ width: 20, height: 20, color: V3.green, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: V3.cream, marginBottom: 2 }}>
                  Olá, {data.investor.name}{data.investor.company ? ` · ${data.investor.company}` : ""}
                </div>
                <div style={{ fontSize: 12, color: V3.muted }}>
                  NDA registrado. Acesso ao deal <strong style={{ color: V3.gold }}>{data.deal.v3_code ?? v3Code}</strong>
                  {data.deal.target_company ? ` — ${data.deal.target_company}` : ""}.
                </div>
              </div>
            </div>

            {/* Navegação Docs / Q&A */}
            <div style={{ display: "flex", borderBottom: `1px solid ${V3.navyBrd}`, marginBottom: 20 }}>
              {[
                { id: "docs" as const, label: "Documentos" },
                { id: "qa"   as const, label: `Perguntas${qaThreads.length > 0 ? ` (${qaThreads.length})` : ""}` },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", border: "none", background: "transparent", cursor: "pointer", borderBottom: `2px solid ${activeSection === tab.id ? V3.gold : "transparent"}`, color: activeSection === tab.id ? V3.gold : V3.muted, transition: "all 0.15s" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── DOCUMENTOS ── */}
            {activeSection === "docs" && (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.documents.map(doc => (
                    <div key={doc.id} onClick={() => !doc.locked && handleOpenDoc(doc)}
                      style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: doc.locked ? "not-allowed" : "pointer", opacity: doc.locked ? 0.5 : 1, transition: "all 0.15s" }}
                      onMouseEnter={e => { if (!doc.locked) (e.currentTarget as HTMLDivElement).style.borderColor = V3.gold; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = V3.navyBrd; }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: doc.locked ? `${V3.muted}15` : `${V3.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FileText style={{ width: 18, height: 18, color: doc.locked ? V3.muted : V3.gold }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: V3.cream }}>{doc.label}</div>
                        <div style={{ fontSize: 11, color: V3.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                          {doc.doc_type}{doc.file_size_bytes ? ` · ${(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : ""}
                        </div>
                      </div>
                      {doc.locked ? <Lock style={{ width: 16, height: 16, color: V3.muted, flexShrink: 0 }} />
                        : openingDoc === doc.id ? <Clock style={{ width: 16, height: 16, color: V3.gold, flexShrink: 0 }} />
                        : <ExternalLink style={{ width: 16, height: 16, color: V3.muted, flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
                {data.documents.length === 0 && (
                  <p style={{ textAlign: "center", color: V3.muted, fontSize: 13, padding: "32px 0" }}>
                    Nenhum documento disponível. Aguarde a liberação pela Mesa V3.
                  </p>
                )}
              </div>
            )}

            {/* ── Q&A ── */}
            {activeSection === "qa" && (
              <div>
                {/* Threads existentes */}
                {qaThreads.map(thread => (
                  <div key={thread.id} style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: V3.cream }}>{thread.subject}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 4,
                        background: thread.status === "answered" ? `${V3.green}20` : `${V3.amber}20`,
                        color: thread.status === "answered" ? V3.green : V3.amber }}>
                        {thread.status === "answered" ? "RESPONDIDA" : "AGUARDANDO"}
                      </span>
                    </div>
                    {thread.deal_qa_messages.filter(m => m.is_published).map(msg => (
                      <div key={msg.id} style={{ marginBottom: 8, padding: "10px 12px", borderRadius: 8,
                        background: msg.sender_type === "buyer" ? `${V3.navy}` : `${V3.gold}10`,
                        border: `1px solid ${msg.sender_type === "buyer" ? V3.navyBrd : `${V3.gold}30`}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: msg.sender_type === "buyer" ? V3.muted : V3.goldLt, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                          {msg.sender_type === "buyer" ? "Você" : "V3 Partners / Vendedor"}
                        </div>
                        <div style={{ fontSize: 13, color: V3.cream, lineHeight: 1.5 }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Formulário nova pergunta */}
                <div style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: V3.goldLt, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
                    Nova Pergunta
                  </div>
                  <input value={qaSubject} onChange={e => setQaSubject(e.target.value)}
                    placeholder="Assunto (ex: Confirmar receita 2024, Situação das pendências jurídicas...)"
                    style={{ width: "100%", background: V3.navy, border: `1px solid ${V3.navyBrd}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: V3.cream, fontFamily: "inherit", marginBottom: 10, outline: "none", boxSizing: "border-box" }} />
                  <textarea value={qaContent} onChange={e => setQaContent(e.target.value)} rows={3}
                    placeholder="Descreva sua dúvida em detalhes..."
                    style={{ width: "100%", background: V3.navy, border: `1px solid ${V3.navyBrd}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: V3.cream, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
                  {qaSuccess && (
                    <div style={{ fontSize: 12, color: V3.green, marginBottom: 8 }}>
                      ✓ Pergunta enviada. A equipe V3 Partners responderá em breve.
                    </div>
                  )}
                  <button onClick={handleSendQuestion} disabled={qaSending || !qaSubject.trim() || !qaContent.trim()}
                    style={{ background: V3.gold, color: V3.navy, border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: qaSending ? "not-allowed" : "pointer", opacity: (!qaSubject.trim() || !qaContent.trim()) ? 0.5 : 1 }}>
                    {qaSending ? "Enviando..." : "Enviar Pergunta →"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, padding: "12px 16px", background: `${V3.gold}08`, border: `1px solid ${V3.gold}20`, borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: V3.muted, lineHeight: 1.6 }}>
                <strong style={{ color: V3.goldLt }}>Confidencialidade:</strong> Documentos protegidos por NDA registrado em {new Date().toLocaleDateString("pt-BR")}.
                {" "}<a href="mailto:joao.lemos@v3partners.com.br" style={{ color: V3.gold }}>joao.lemos@v3partners.com.br</a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

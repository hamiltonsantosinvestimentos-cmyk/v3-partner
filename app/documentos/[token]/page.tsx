"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type ChecklistItem = { id: string; label: string; required: boolean; hint?: string; uploaded: boolean };

type TokenInfo = {
  valid:      boolean;
  reason?:    string;
  label?:     string;
  expires_at?: string;
  remaining?: number;
  proposal?:  { code: string; client_name: string; credit_line: string };
  checklist?: ChecklistItem[];
};

type ItemStatus = "idle" | "uploading" | "done" | "error";

export default function CreditUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ItemStatus>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/public/credit-upload/${token}`)
      .then(r => r.json())
      .then((d: TokenInfo) => {
        setTokenInfo(d);
        if (d.checklist) setChecklist(d.checklist);
        setLoading(false);
      })
      .catch(() => { setTokenInfo({ valid: false, reason: "Erro ao verificar link." }); setLoading(false); });
  }, [token]);

  async function handleUpload(docId: string, file: File) {
    setStatusMap(prev => ({ ...prev, [docId]: "uploading" }));
    setErrorMap(prev => ({ ...prev, [docId]: "" }));
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_id", docId);
      const res = await fetch(`/api/public/credit-upload/${token}`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setStatusMap(prev => ({ ...prev, [docId]: "error" }));
        setErrorMap(prev => ({ ...prev, [docId]: json.error ?? "Erro ao enviar arquivo." }));
        return;
      }
      setStatusMap(prev => ({ ...prev, [docId]: "done" }));
      setChecklist(prev => prev.map(c => c.id === docId ? { ...c, uploaded: true } : c));
    } catch {
      setStatusMap(prev => ({ ...prev, [docId]: "error" }));
      setErrorMap(prev => ({ ...prev, [docId]: "Falha de conexão. Verifique sua internet e tente novamente." }));
    }
  }

  const requiredDone = checklist.filter(c => c.required).every(c => c.uploaded);
  const anyUploaded = checklist.some(c => c.uploaded);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.mutedText}>Verificando link...</p>
        </div>
      </div>
    );
  }

  if (!tokenInfo?.valid) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style={{ height: 40, width: "auto" }} />
          </div>
          <h2 style={{ ...styles.title, color: "#F4A0A0" }}>Link inválido</h2>
          <p style={styles.mutedText}>{tokenInfo?.reason ?? "Este link não é válido ou expirou."}</p>
          <p style={{ ...styles.mutedText, marginTop: 16 }}>
            Entre em contato com seu parceiro V3 Partners para solicitar um novo link.
          </p>
          <p style={styles.footer}>V3 Partners Soluções Ltda</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={120} height={40} style={{ objectFit: "contain" }} />
        </div>

        <h1 style={styles.title}>Envio de Documentos</h1>
        <p style={styles.mutedText}>
          {tokenInfo.proposal ? `${tokenInfo.proposal.client_name} · ${tokenInfo.proposal.credit_line}` : "V3 Partners — envio seguro de documentos"}
        </p>
        {tokenInfo.remaining !== undefined && (
          <p style={{ ...styles.mutedText, fontSize: 11, marginTop: 4 }}>
            {tokenInfo.remaining} {tokenInfo.remaining === 1 ? "envio restante" : "envios restantes"} neste link
          </p>
        )}

        <div style={styles.notice}>
          <p style={{ margin: 0, fontSize: 12, color: "#F5F1E8", lineHeight: 1.5 }}>
            Este é um canal seguro e privado. Envie cada documento abaixo clicando em &quot;Anexar&quot;.
            Seus arquivos vão direto para a equipe da V3 Partners.
          </p>
        </div>

        {requiredDone && (
          <div style={styles.successNotice}>
            <p style={{ margin: 0, fontSize: 12, color: "#A8D5B5", fontWeight: 600 }}>
              ✓ Todos os documentos obrigatórios foram enviados. Obrigado!
            </p>
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: "left" }}>
          {checklist.map((item) => {
            const status = statusMap[item.id] ?? "idle";
            const uploaded = item.uploaded;
            return (
              <div key={item.id} style={{
                ...styles.docItem,
                borderColor: uploaded ? "rgba(16,185,129,0.35)" : "#243A66",
                background: uploaded ? "rgba(16,185,129,0.06)" : "#111F35",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: uploaded ? "#A8D5B5" : "#F5F1E8" }}>{item.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: item.required ? "rgba(201,168,76,0.15)" : "rgba(155,175,197,0.15)",
                      color: item.required ? "#C9A84C" : "#9BAFC5",
                    }}>
                      {item.required ? "OBRIGATÓRIO" : "OPCIONAL"}
                    </span>
                  </div>
                  {item.hint && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#7A8FA8" }}>{item.hint}</p>}
                  {status === "error" && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#F4A0A0" }}>{errorMap[item.id]}</p>}
                </div>
                <button
                  disabled={status === "uploading"}
                  onClick={() => { setPendingDocId(item.id); fileRef.current?.click(); }}
                  style={{
                    ...styles.attachBtn,
                    opacity: status === "uploading" ? 0.6 : 1,
                    cursor: status === "uploading" ? "not-allowed" : "pointer",
                    color: uploaded ? "#A8D5B5" : "#C9A84C",
                    borderColor: uploaded ? "rgba(16,185,129,0.35)" : "rgba(201,168,76,0.3)",
                  }}
                >
                  {status === "uploading" ? "Enviando..." : uploaded ? "Reenviar" : "Anexar"}
                </button>
              </div>
            );
          })}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && pendingDocId) handleUpload(pendingDocId, file);
            e.target.value = "";
          }}
        />

        {anyUploaded && (
          <p style={{ ...styles.mutedText, marginTop: 20 }}>
            Você pode fechar esta página a qualquer momento — os documentos já enviados foram recebidos com segurança.
          </p>
        )}

        <p style={styles.footer}>
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#09081A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  card: {
    background: "#0C1929",
    border: "1px solid #1B3050",
    borderRadius: 16,
    padding: "40px 36px",
    maxWidth: 560,
    width: "100%",
    textAlign: "center",
  },
  logoWrap: { display: "flex", justifyContent: "center", marginBottom: 20 },
  title: { margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#F5F1E8" },
  mutedText: { margin: "4px 0 0", fontSize: 13, color: "#9BAFC5", lineHeight: 1.6 },
  notice: {
    background: "#162744", border: "1px solid #243A66", borderRadius: 8,
    padding: "12px 16px", margin: "20px 0 0", textAlign: "left",
  },
  successNotice: {
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8,
    padding: "10px 16px", margin: "12px 0 0", textAlign: "left",
  },
  docItem: {
    display: "flex", alignItems: "center", gap: 12,
    border: "1px solid", borderRadius: 10, padding: "12px 14px", marginBottom: 8,
  },
  attachBtn: {
    flexShrink: 0, background: "rgba(201,168,76,0.08)", border: "1px solid",
    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700,
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  spinner: {
    width: 40, height: 40, border: "3px solid #1B3050", borderTop: "3px solid #C9A84C",
    borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
  },
  footer: { marginTop: 24, fontSize: 11, color: "#3D5A73", lineHeight: 1.6 },
};

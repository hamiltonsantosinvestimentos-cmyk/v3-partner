"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type TokenInfo = {
  valid:      boolean;
  reason?:    string;
  label?:     string;
  expires_at?: string;
  remaining?: number;
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls", ".docx", ".doc"];

export default function UploadPage() {
  const { token } = useParams<{ token: string }>();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [files,     setFiles]     = useState<File[]>([]);
  const [status,    setStatus]    = useState<UploadStatus>("idle");
  const [message,   setMessage]   = useState("");
  const [progress,  setProgress]  = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/public/upload/${token}`)
      .then(r => r.json())
      .then((d: TokenInfo) => { setTokenInfo(d); setLoading(false); })
      .catch(() => { setTokenInfo({ valid: false, reason: "Erro ao verificar link." }); setLoading(false); });
  }, [token]);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const valid = Array.from(newFiles).filter(f => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext) && f.size <= 32 * 1024 * 1024;
    });
    setFiles(prev => [...prev, ...valid].slice(0, 10));
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setStatus("uploading");
    setProgress(0);

    let uploaded = 0;
    let hasError = false;

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`/api/public/upload/${token}`, { method: "POST", body: form });
        if (!res.ok) {
          const d = await res.json();
          setMessage(d.error ?? "Erro ao enviar arquivo.");
          hasError = true;
          break;
        }
        uploaded++;
        setProgress(Math.round((uploaded / files.length) * 100));
      } catch {
        setMessage("Falha de conexão. Verifique sua internet e tente novamente.");
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      setStatus("success");
      setMessage(`${uploaded} ${uploaded === 1 ? "documento enviado" : "documentos enviados"} com sucesso.`);
      setFiles([]);
    } else {
      setStatus("error");
    }
  }

  const fmtSize = (b: number) => b < 1024 * 1024
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;

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
            Entre em contato com a V3 Partners para solicitar um novo link.
          </p>
          <p style={{ ...styles.footer }}>deal@v3partners.com.br</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style={{ height: 40, width: "auto" }} />
          </div>
          <div style={styles.successIcon}>✓</div>
          <h2 style={{ ...styles.title, color: "#A8D5B5" }}>Documentação recebida</h2>
          <p style={styles.mutedText}>{message}</p>
          <p style={{ ...styles.mutedText, marginTop: 12 }}>
            A documentação foi registrada com segurança pela Mesa M&A da V3 Partners.
            Nossa equipe entrará em contato para confirmar o recebimento e os próximos passos.
          </p>
          <p style={{ ...styles.footer }}>V3 Partners Soluções Ltda · deal@v3partners.com.br</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <Image src="/v3-logo-flat-gold-alpha.png"
                 alt="V3 Partners" width={120} height={40} style={{ objectFit: "contain" }} />
        </div>

        <h1 style={styles.title}>Envio de Documentos</h1>
        <p style={styles.mutedText}>
          {tokenInfo.label
            ? `Link gerado para: ${tokenInfo.label}`
            : "V3 Partners — envio seguro de documentos"}
        </p>

        {tokenInfo.remaining !== undefined && (
          <p style={{ ...styles.mutedText, fontSize: 11, marginTop: 4 }}>
            {tokenInfo.remaining} {tokenInfo.remaining === 1 ? "envio restante" : "envios restantes"} neste link
          </p>
        )}

        {/* Aviso de segurança */}
        <div style={styles.notice}>
          <p style={{ margin: 0, fontSize: 12, color: "#F5F1E8", lineHeight: 1.5 }}>
            Este é um canal seguro e privado. Seus documentos são enviados diretamente
            para a equipe de V3 Partners e não ficam acessíveis publicamente.
          </p>
        </div>

        {/* Área de upload */}
        <div
          style={styles.dropZone}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "#C9A84C", fontWeight: 600 }}>
            Clique ou arraste os arquivos aqui
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9BAFC5" }}>
            PDF, imagens, Excel, Word — máx. 32 MB por arquivo
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc"
            style={{ display: "none" }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* Lista de arquivos */}
        {files.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {files.map((f, i) => (
              <div key={i} style={styles.fileItem}>
                <span style={{ fontSize: 13, color: "#C8D4E3", flex: 1 }}>{f.name}</span>
                <span style={{ fontSize: 11, color: "#9BAFC5", marginRight: 12 }}>{fmtSize(f.size)}</span>
                <button
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  style={styles.removeBtn}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progresso */}
        {status === "uploading" && (
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
        )}

        {/* Erro */}
        {status === "error" && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#F4A0A0" }}>{message}</p>
        )}

        {/* Botão */}
        <button
          onClick={handleSubmit}
          disabled={files.length === 0 || status === "uploading"}
          style={{
            ...styles.btn,
            opacity: files.length === 0 || status === "uploading" ? 0.5 : 1,
            cursor:  files.length === 0 || status === "uploading" ? "not-allowed" : "pointer",
          }}
        >
          {status === "uploading" ? `Enviando... ${progress}%` : `Enviar ${files.length > 0 ? `(${files.length})` : ""}`}
        </button>

        <p style={styles.footer}>
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br />
          <a href="mailto:deal@v3partners.com.br" style={{ color: "#C9A84C", textDecoration: "none" }}>
            deal@v3partners.com.br
          </a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:      "100vh",
    background:     "#09081A",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "24px 16px",
    fontFamily:     "'DM Sans', Arial, sans-serif",
  },
  card: {
    background:   "#0C1929",
    border:       "1px solid #1B3050",
    borderRadius: 16,
    padding:      "40px 36px",
    maxWidth:     520,
    width:        "100%",
    textAlign:    "center",
  },
  logoWrap: {
    display:        "flex",
    justifyContent: "center",
    marginBottom:   20,
  },
  title: {
    margin:     "0 0 8px",
    fontSize:   22,
    fontWeight: 700,
    color:      "#F5F1E8",
  },
  mutedText: {
    margin:     "4px 0 0",
    fontSize:   13,
    color:      "#9BAFC5",
    lineHeight: 1.6,
  },
  notice: {
    background:   "#162744",
    border:       "1px solid #243A66",
    borderRadius: 8,
    padding:      "12px 16px",
    margin:       "20px 0 0",
    textAlign:    "left",
  },
  dropZone: {
    border:       "2px dashed #243A66",
    borderRadius: 10,
    padding:      "32px 24px",
    marginTop:    16,
    cursor:       "pointer",
    transition:   "border-color 0.2s",
  },
  fileItem: {
    display:        "flex",
    alignItems:     "center",
    background:     "#162744",
    border:         "1px solid #243A66",
    borderRadius:   6,
    padding:        "8px 12px",
    marginBottom:   6,
  },
  removeBtn: {
    background:  "transparent",
    border:      "none",
    color:       "#9BAFC5",
    cursor:      "pointer",
    fontSize:    14,
    padding:     "0 4px",
  },
  progressBar: {
    background:   "#162744",
    borderRadius: 4,
    height:       6,
    marginTop:    16,
    overflow:     "hidden",
  },
  progressFill: {
    background:    "#C9A84C",
    height:        "100%",
    borderRadius:  4,
    transition:    "width 0.3s ease",
  },
  btn: {
    display:      "block",
    width:        "100%",
    marginTop:    20,
    background:   "#C9A84C",
    color:        "#07101E",
    border:       "none",
    borderRadius: 8,
    padding:      "14px 0",
    fontSize:     15,
    fontWeight:   700,
    fontFamily:   "'DM Sans', Arial, sans-serif",
    letterSpacing: "0.02em",
    transition:   "opacity 0.2s",
  },
  successIcon: {
    width:          56,
    height:         56,
    background:     "#2D6A4F",
    borderRadius:   "50%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       24,
    color:          "#A8D5B5",
    margin:         "0 auto 16px",
    fontWeight:     700,
  },
  spinner: {
    width:       40,
    height:      40,
    border:      "3px solid #1B3050",
    borderTop:   "3px solid #C9A84C",
    borderRadius: "50%",
    animation:   "spin 0.8s linear infinite",
    margin:      "0 auto 16px",
  },
  footer: {
    marginTop:  24,
    fontSize:   11,
    color:      "#3D5A73",
    lineHeight: 1.6,
  },
};

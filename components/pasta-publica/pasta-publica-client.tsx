"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen, FolderClosed, FileText, Download, ChevronRight,
  ChevronDown, ArrowLeft, Search, Building2, CreditCard, Users, Shield, Gavel,
} from "lucide-react";

interface FileItem {
  name: string;
  is_folder: boolean;
  size: number;
  mime_type: string;
  path: string;
  created_at: string | null;
}

const VERTICAL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  MA:             { label: "M&A",            icon: <Building2 size={16} />,  color: "#C9A84C" },
  Credito:        { label: "Crédito",         icon: <CreditCard size={16} />, color: "#10B981" },
  Consorcios:     { label: "Consórcios",     icon: <Users size={16} />,      color: "#6366F1" },
  Administracao:  { label: "Administração",  icon: <Shield size={16} />,     color: "#F59E0B" },
  BolsaDeAtivos:  { label: "Bolsa de Ativos", icon: <Gavel size={16} />,     color: "#3B82F6" },
};

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fileIcon(mime: string, name: string) {
  if (name.endsWith(".pdf")) return "📄";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "📝";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) return "📊";
  if (name.endsWith(".pptx")) return "📑";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (name.endsWith(".html")) return "🌐";
  return "📎";
}

export function PastaPublicaClient() {
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/governance/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFiles(currentPath); }, [currentPath, fetchFiles]);

  const navigateTo = (path: string) => setCurrentPath(path);

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    setDownloading(filePath);
    try {
      const res = await fetch(`/api/governance/download?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = fileName;
        a.target = "_blank";
        a.click();
      }
    } catch { /* silent */ }
    setDownloading(null);
  };

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const filteredFiles = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  const folders = filteredFiles.filter(f => f.is_folder);
  const docs = filteredFiles.filter(f => !f.is_folder);
  const depth = breadcrumbs.length;

  return (
    <div style={{ padding: "0 24px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <FolderOpen size={24} color="#C9A84C" />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F5F1E8", margin: 0 }}>
            Pasta Publica
          </h1>
        </div>
        <p style={{ fontSize: 12, color: "#9BAFC5", margin: 0 }}>
          MPS Documentos V3 — Estrutura governada por vertical
        </p>
      </div>

      {/* Breadcrumb + Search */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, marginBottom: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          {currentPath && (
            <button
              onClick={goUp}
              style={{
                background: "rgba(201,168,76,.12)", border: "1px solid rgba(201,168,76,.25)",
                borderRadius: 6, padding: "4px 8px", cursor: "pointer",
                color: "#C9A84C", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <ArrowLeft size={12} /> Voltar
            </button>
          )}
          <span
            onClick={() => setCurrentPath("")}
            style={{ color: "#C9A84C", cursor: "pointer", fontWeight: 700 }}
          >
            PASTA PUBLICA
          </span>
          {breadcrumbs.map((crumb, i) => {
            const path = breadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={path} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronRight size={12} color="#243A66" />
                <span
                  onClick={() => !isLast && navigateTo(path)}
                  style={{
                    color: isLast ? "#F5F1E8" : "#9BAFC5",
                    cursor: isLast ? "default" : "pointer",
                    fontWeight: isLast ? 600 : 400,
                    maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {crumb}
                </span>
              </span>
            );
          })}
        </div>

        <div style={{ position: "relative" }}>
          <Search size={14} color="#9BAFC5" style={{ position: "absolute", left: 10, top: 8 }} />
          <input
            type="text"
            placeholder="Buscar arquivo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "#13223A", border: "1px solid #162744", borderRadius: 8,
              padding: "6px 12px 6px 30px", color: "#F5F1E8", fontSize: 12,
              outline: "none", width: 220,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{
        background: "#13223A", border: "1px solid #162744",
        borderRadius: 12, overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9BAFC5", fontSize: 13 }}>
            Carregando...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9BAFC5", fontSize: 13 }}>
            {search ? "Nenhum resultado para a busca" : "Pasta vazia"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #162744" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", color: "#E8C97A", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
                  Nome
                </th>
                {depth > 1 && (
                  <>
                    <th style={{ padding: "10px 16px", textAlign: "right", color: "#E8C97A", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", width: 80 }}>
                      Tamanho
                    </th>
                    <th style={{ padding: "10px 16px", textAlign: "center", color: "#E8C97A", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", width: 80 }}>
                      Data
                    </th>
                    <th style={{ padding: "10px 16px", textAlign: "center", width: 60 }} />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {folders.map(folder => {
                const meta = depth === 0 ? VERTICAL_META[folder.name] : null;
                return (
                  <tr
                    key={folder.path}
                    onClick={() => navigateTo(folder.path)}
                    style={{ cursor: "pointer", borderBottom: "1px solid rgba(22,39,68,.6)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(22,39,68,.5)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 16px" }} colSpan={depth > 1 ? 4 : 1}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {meta ? (
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: `${meta.color}22`, color: meta.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {meta.icon}
                          </div>
                        ) : (
                          <FolderClosed size={18} color="#C9A84C" />
                        )}
                        <div>
                          <div style={{ color: "#F5F1E8", fontWeight: 600 }}>
                            {meta ? meta.label : folder.name}
                          </div>
                          {meta && (
                            <div style={{ color: "#9BAFC5", fontSize: 10, marginTop: 1 }}>
                              Vertical {meta.label}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} color="#243A66" style={{ marginLeft: "auto" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {docs.map(file => (
                <tr
                  key={file.path}
                  style={{ borderBottom: "1px solid rgba(22,39,68,.6)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(22,39,68,.5)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{fileIcon(file.mime_type, file.name)}</span>
                      <span style={{ color: "#F5F1E8", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.name}
                      </span>
                    </div>
                  </td>
                  {depth > 1 && (
                    <>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#9BAFC5" }}>
                        {formatSize(file.size as number)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center", color: "#9BAFC5" }}>
                        {formatDate(file.created_at)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        <button
                          onClick={() => handleDownload(file.path, file.name)}
                          disabled={downloading === file.path}
                          style={{
                            background: downloading === file.path ? "#243A66" : "rgba(201,168,76,.12)",
                            border: "1px solid rgba(201,168,76,.25)",
                            borderRadius: 6, padding: "4px 8px", cursor: "pointer",
                            color: "#C9A84C", display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          <Download size={12} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer stats */}
      <div style={{
        display: "flex", gap: 16, marginTop: 12,
        fontSize: 10, color: "#243A66",
      }}>
        <span>{folders.length} pastas</span>
        <span>{docs.length} arquivos</span>
        {docs.length > 0 && (
          <span>{formatSize(docs.reduce((s, f) => s + (f.size as number), 0))}</span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

type QrState = {
  qrcode: string | null;
  status: string;
};

type Conversa = {
  id: string;
  phone: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export function SdrClient() {
  const [qr, setQr] = useState<QrState>({ qrcode: null, status: "loading" });
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState("");

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch("/api/sdr/qrcode");
      const data = await res.json();
      setQr(data);
    } catch {
      setQr({ qrcode: null, status: "error" });
    }
  }, []);

  const fetchConversas = useCallback(async () => {
    setLoadingConversas(true);
    try {
      const url = phoneFilter
        ? `/api/sdr/conversas?phone=${encodeURIComponent(phoneFilter)}`
        : "/api/sdr/conversas";
      const res = await fetch(url);
      const data = await res.json();
      setConversas(data.conversas ?? []);
    } catch {
      setConversas([]);
    } finally {
      setLoadingConversas(false);
    }
  }, [phoneFilter]);

  useEffect(() => {
    fetchQr();
    // Poll QR every 10s until connected
    const interval = setInterval(() => {
      fetchQr();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchQr]);

  useEffect(() => {
    fetchConversas();
  }, [fetchConversas]);

  const statusColor = {
    connected: "#4ade80",
    pending: "#C9A84C",
    disconnected: "#f87171",
    error: "#f87171",
    loading: "#7A8FA8",
  }[qr.status] ?? "#7A8FA8";

  const statusLabel = {
    connected: "Conectado",
    pending: "Aguardando escaneamento",
    disconnected: "Desconectado",
    error: "Erro",
    loading: "Verificando...",
  }[qr.status] ?? qr.status;

  // Group conversations by phone
  const phones = [...new Set(conversas.map((c) => c.phone))];

  return (
    <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: "#C9A84C", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          AGENTE SDR
        </p>
        <h1 style={{ color: "#F0ECE4", fontSize: 28, fontWeight: 700, margin: 0 }}>
          WhatsApp SDR
        </h1>
        <p style={{ color: "#7A8FA8", fontSize: 14, marginTop: 4 }}>
          Gerencie a conexão e conversas do agente de qualificação de leads
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
        {/* Left: QR / Status */}
        <div>
          <div style={{
            background: "#162744",
            borderRadius: 16,
            border: "1px solid #243A66",
            padding: 24,
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
              }} />
              <span style={{ color: "#F0ECE4", fontWeight: 600, fontSize: 14 }}>{statusLabel}</span>
            </div>

            {qr.status === "connected" ? (
              <div style={{
                background: "#243A66",
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <p style={{ color: "#4ade80", fontWeight: 600, margin: 0 }}>WhatsApp Conectado!</p>
                <p style={{ color: "#7A8FA8", fontSize: 12, marginTop: 4 }}>
                  O agente SDR está ativo e pronto para atender leads.
                </p>
              </div>
            ) : qr.qrcode ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "#7A8FA8", fontSize: 12, marginBottom: 12 }}>
                  Escaneie o QR code com seu WhatsApp Business
                </p>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 12,
                  display: "inline-block",
                }}>
                  <Image
                    src={qr.qrcode.startsWith("data:") ? qr.qrcode : `data:image/png;base64,${qr.qrcode}`}
                    alt="QR Code WhatsApp"
                    width={240}
                    height={240}
                    style={{ display: "block" }}
                  />
                </div>
                <p style={{ color: "#7A8FA8", fontSize: 11, marginTop: 8 }}>
                  QR expira em 60 segundos
                </p>
              </div>
            ) : (
              <div style={{
                background: "#243A66",
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
              }}>
                <div style={{ color: "#7A8FA8", fontSize: 13 }}>
                  {qr.status === "loading" ? "Verificando conexão..." : "Nenhum QR disponível"}
                </div>
              </div>
            )}

            <button
              onClick={fetchQr}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                background: "#243A66",
                border: "1px solid #C9A84C",
                borderRadius: 8,
                color: "#C9A84C",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Atualizar Status
            </button>
          </div>

          {/* Stats */}
          <div style={{
            background: "#162744",
            borderRadius: 16,
            border: "1px solid #243A66",
            padding: 20,
          }}>
            <p style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              ESTATÍSTICAS
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#7A8FA8", fontSize: 13 }}>Total de leads</span>
                <span style={{ color: "#F0ECE4", fontWeight: 700 }}>{phones.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#7A8FA8", fontSize: 13 }}>Total de mensagens</span>
                <span style={{ color: "#F0ECE4", fontWeight: 700 }}>{conversas.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#7A8FA8", fontSize: 13 }}>Respostas do agente</span>
                <span style={{ color: "#F0ECE4", fontWeight: 700 }}>{conversas.filter(c => c.role === "assistant").length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Conversations */}
        <div style={{
          background: "#162744",
          borderRadius: 16,
          border: "1px solid #243A66",
          padding: 24,
          minHeight: 400,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
              CONVERSAS
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Filtrar por telefone..."
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                style={{
                  background: "#111F35",
                  border: "1px solid #243A66",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "#F0ECE4",
                  fontSize: 13,
                  outline: "none",
                  width: 200,
                }}
              />
              <button
                onClick={fetchConversas}
                style={{
                  padding: "6px 14px",
                  background: "#243A66",
                  border: "1px solid #243A66",
                  borderRadius: 8,
                  color: "#F0ECE4",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Buscar
              </button>
            </div>
          </div>

          {loadingConversas ? (
            <div style={{ color: "#7A8FA8", textAlign: "center", padding: 40 }}>Carregando...</div>
          ) : conversas.length === 0 ? (
            <div style={{ color: "#7A8FA8", textAlign: "center", padding: 40 }}>
              Nenhuma conversa encontrada.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 600, overflowY: "auto" }}>
              {conversas.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    flexDirection: c.role === "user" ? "row" : "row-reverse",
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: c.role === "user" ? "#243A66" : "#C9A84C20",
                    border: `1px solid ${c.role === "user" ? "#243A66" : "#C9A84C"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    flexShrink: 0,
                  }}>
                    {c.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div style={{ maxWidth: "75%" }}>
                    <div style={{
                      fontSize: 10,
                      color: "#7A8FA8",
                      marginBottom: 2,
                      textAlign: c.role === "user" ? "left" : "right",
                    }}>
                      {c.role === "user" ? c.phone : "Agente SDR"} · {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div style={{
                      background: c.role === "user" ? "#111F35" : "#C9A84C15",
                      border: `1px solid ${c.role === "user" ? "#243A66" : "#C9A84C30"}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      color: "#F0ECE4",
                      fontSize: 13,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

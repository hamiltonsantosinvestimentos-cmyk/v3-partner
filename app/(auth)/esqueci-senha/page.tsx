"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      // redirectTo aponta pro callback do Supabase, que troca o code pela
      // sessão e manda o usuário pra /auth/update-password — mesma tela já
      // usada pra troca de senha obrigatória no primeiro acesso.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });

      // Nunca revela se o e-mail existe ou não na base (evita enumeração de
      // contas) — sempre mostra a mesma mensagem de sucesso, mesmo se
      // resetError vier preenchido por "usuário não encontrado".
      if (resetError && resetError.status && resetError.status >= 500) {
        setError("Erro ao enviar o e-mail. Tente novamente em instantes.");
        setLoading(false);
        return;
      }

      setEnviado(true);
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#09081A" }}>

      {/* Background layers — mesmo padrão visual da tela de login */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(196,146,46,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(196,146,46,0.04) 1px, transparent 1px)",
        backgroundSize: "36px 36px"
      }} />
      <div style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300,
        background: "radial-gradient(ellipse, rgba(196,146,46,0.08) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 420, margin: "0 20px" }}>
        <div style={{
          background: "linear-gradient(160deg, #091221 0%, #09081A 100%)",
          border: "1px solid rgba(196,146,46,0.15)",
          borderRadius: 20,
          padding: "40px 36px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(196,146,46,0.08) inset",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(196,146,46,0.5), transparent)"
          }} />

          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            <div style={{
              width: 120, height: 120, borderRadius: 24,
              overflow: "hidden",
              background: "#0E2040",
              boxShadow: "0 16px 48px rgba(196,146,46,0.25), 0 0 0 1px rgba(196,146,46,0.18)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Image
                src="/logo.jpg"
                alt="V3 PARTNERS"
                width={120}
                height={120}
                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                priority
              />
            </div>
            <p style={{ fontSize: 10, color: "#7A8FA8", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 14 }}>
              Recuperar Acesso
            </p>
          </div>

          {enviado ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle2 style={{ width: 24, height: 24, color: "#34D399" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#F0ECE4" }}>E-mail enviado!</p>
              <p style={{ fontSize: 13, color: "#7A8FA8", lineHeight: 1.6 }}>
                Se <strong style={{ color: "#E8EDF5" }}>{email}</strong> estiver cadastrado, você vai receber um link
                pra criar uma nova senha em instantes. Confere também a caixa de spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "#7A8FA8", lineHeight: 1.6, marginBottom: 4 }}>
                Digite o e-mail da sua conta — vamos te mandar um link pra criar uma nova senha.
              </p>

              <div>
                <label style={{
                  fontSize: 10, fontWeight: 700, color: "#7A8FA8",
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  display: "block", marginBottom: 7
                }}>E-mail</label>
                <div style={{ position: "relative" }}>
                  <Mail style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#7A8FA8" }} />
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com" required autoFocus
                    style={{
                      width: "100%", height: 46, paddingLeft: 42, paddingRight: 16,
                      background: "#0F1E35", border: "1px solid #122036", borderRadius: 12,
                      color: "#E8EDF5", fontSize: 14, outline: "none", boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(196,146,46,0.4)"}
                    onBlur={(e) => e.target.style.borderColor = "#122036"}
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  padding: "10px 13px", borderRadius: 10,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#F87171", fontSize: 13
                }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                marginTop: 4, height: 48,
                background: loading
                  ? "rgba(196,146,46,0.4)"
                  : "linear-gradient(120deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
                backgroundSize: "200% 100%",
                color: "#09081A", border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: 700, letterSpacing: "0.04em",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: loading ? "none" : "0 4px 20px rgba(196,146,46,0.35)",
                transition: "all 0.2s",
              }}>
                {loading ? "Enviando..." : (<>Enviar link de recuperação <ArrowRight style={{ width: 16, height: 16 }} /></>)}
              </button>
            </form>
          )}

          <Link href="/login" style={{
            marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontSize: 12, color: "#7A8FA8", textDecoration: "none",
          }}>
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Voltar pro login
          </Link>
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "#3A5068", marginTop: 18, letterSpacing: "0.05em" }}>
          © {new Date().getFullYear()} V3 Partners. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

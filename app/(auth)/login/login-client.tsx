"use client";

import React, { useState } from "react";
import type { Marca } from "@/lib/enterprise";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";

// Marca do Enterprise vem do servidor (page.tsx), pelo domínio acessado.
export function LoginClient({ marca }: { marca: Marca | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const IS_DEMO = false;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (IS_DEMO) {
        // Demo mode: cookie-based login
        const res = await fetch("/api/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Email ou senha inválidos.");
          setLoading(false);
          return;
        }
      } else {
        // Production mode: Supabase Auth via API
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Email ou senha inválidos.");
          setLoading(false);
          return;
        }
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "var(--wl-principal, var(--wl-fundo, #09081A))" }}>

      {/* Background layers */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(color-mix(in srgb, var(--wl-acento, #C4922E) 4%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--wl-acento, #C4922E) 4%, transparent) 1px, transparent 1px)",
        backgroundSize: "36px 36px"
      }} />
      <div style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300,
        background: "radial-gradient(ellipse, color-mix(in srgb, var(--wl-acento, #C4922E) 8%, transparent) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "5%",
        width: 400, height: 400,
        background: "radial-gradient(ellipse, color-mix(in srgb, var(--wl-medio, #243A66) 30%, transparent) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      {/* Card */}
      <div style={{ position: "relative", width: "100%", maxWidth: 420, margin: "0 20px" }}>
        <div style={{
          background: "linear-gradient(160deg, var(--wl-fundo-2, #091221) 0%, var(--wl-fundo, #09081A) 100%)",
          border: "1px solid color-mix(in srgb, var(--wl-acento, #C4922E) 15%, transparent)",
          borderRadius: 20,
          padding: "40px 36px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px color-mix(in srgb, var(--wl-acento, #C4922E) 8%, transparent) inset",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
            background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--wl-acento, #C4922E) 50%, transparent), transparent)"
          }} />

          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
            <div style={{
              width: 200, height: 200, borderRadius: 28,
              overflow: "hidden",
              background: "var(--wl-principal, #0E2040)",
              boxShadow: "0 16px 48px color-mix(in srgb, var(--wl-acento, #C4922E) 25%, transparent), 0 0 0 1px color-mix(in srgb, var(--wl-acento, #C4922E) 18%, transparent)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {marca?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={marca.logoUrl} alt={marca.nome} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
              ) : (
                <Image
                  src="/logo.jpg"
                  alt="V3 PARTNERS"
                  width={200}
                  height={200}
                  style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                  priority
                />
              )}
            </div>
            <p style={{ fontSize: 10, color: "var(--wl-texto-2, #7A8FA8)", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 14 }}>
              {marca ? marca.nome : "Plataforma Financeira"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, color: "var(--wl-texto-2, #7A8FA8)",
                textTransform: "uppercase", letterSpacing: "0.1em",
                display: "block", marginBottom: 7
              }}>E-mail</label>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--wl-texto-2, #7A8FA8)" }} />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  style={{
                    width: "100%", height: 46, paddingLeft: 42, paddingRight: 16,
                    background: "var(--wl-base, #0F1E35)", border: "1px solid var(--wl-base, #122036)", borderRadius: 12,
                    color: "var(--wl-texto, #E8EDF5)", fontSize: 14, outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "color-mix(in srgb, var(--wl-acento, #C4922E) 40%, transparent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--wl-base, #122036)"}
                />
              </div>
            </div>

            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, color: "var(--wl-texto-2, #7A8FA8)",
                textTransform: "uppercase", letterSpacing: "0.1em",
                display: "block", marginBottom: 7
              }}>Senha</label>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--wl-texto-2, #7A8FA8)" }} />
                <input
                  type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: "100%", height: 46, paddingLeft: 42, paddingRight: 50,
                    background: "var(--wl-base, #0F1E35)", border: "1px solid var(--wl-base, #122036)", borderRadius: 12,
                    color: "var(--wl-texto, #E8EDF5)", fontSize: 14, outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "color-mix(in srgb, var(--wl-acento, #C4922E) 40%, transparent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--wl-base, #122036)"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--wl-texto-2, #7A8FA8)", padding: 0
                  }}>
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <Link href="/esqueci-senha" style={{ fontSize: 12, color: "var(--wl-texto-2, #7A8FA8)", textDecoration: "none" }}>
                  Esqueci minha senha
                </Link>
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
                ? "color-mix(in srgb, var(--wl-acento, #C4922E) 40%, transparent)"
                : "linear-gradient(120deg, var(--wl-acento, #C9A84C) 0%, var(--wl-acento-2, #E8C97A) 50%, var(--wl-acento, #C9A84C) 100%)",
              backgroundSize: "200% 100%",
              color: "var(--wl-fundo, #09081A)", border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700, letterSpacing: "0.04em",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading ? "none" : "0 4px 20px color-mix(in srgb, var(--wl-acento, #C4922E) 35%, transparent)",
              transition: "all 0.2s",
            }}>
              {loading ? "Entrando..." : (<>Acessar Plataforma <ArrowRight style={{ width: 16, height: 16 }} /></>)}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "var(--wl-medio, #3A5068)", marginTop: 18, letterSpacing: "0.05em" }}>
          {marca ? <>{marca.nome} · Powered by V3 Partners</> : <>© {new Date().getFullYear()} V3 Partners. Todos os direitos reservados.</>}
        </p>
      </div>
    </div>
  );
}

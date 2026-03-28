"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Sparkles } from "lucide-react";
import { demoLogin, IS_DEMO_MODE } from "@/lib/demo-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (IS_DEMO_MODE) {
      const user = demoLogin(email, password);
      if (!user) {
        setError("Email ou senha inválidos.");
        setLoading(false);
        return;
      }
      document.cookie = `v3_demo_session=${JSON.stringify({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      })}; path=/; max-age=86400`;
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const quickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#050C18" }}>

      {/* ── Background layers ── */}
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(196,146,46,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(196,146,46,0.04) 1px, transparent 1px)",
        backgroundSize: "36px 36px"
      }} />
      {/* Gold glow top-center */}
      <div style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300,
        background: "radial-gradient(ellipse, rgba(196,146,46,0.08) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />
      {/* Blue glow bottom-left */}
      <div style={{
        position: "absolute", bottom: "10%", left: "5%",
        width: 400, height: 400,
        background: "radial-gradient(ellipse, rgba(26,79,196,0.06) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      {/* ── Card ── */}
      <div style={{ position: "relative", width: "100%", maxWidth: 420, margin: "0 20px" }}>
        <div style={{
          background: "linear-gradient(160deg, #091221 0%, #060E1C 100%)",
          border: "1px solid rgba(196,146,46,0.15)",
          borderRadius: 20,
          padding: "40px 36px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(196,146,46,0.08) inset",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Top shine */}
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(196,146,46,0.5), transparent)"
          }} />

          {/* ── Logo ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            {/* Logo completo — fundo navy idêntico ao da imagem para integração perfeita */}
            <div style={{
              width: 200, height: 200, borderRadius: 28,
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
                width={200}
                height={200}
                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                priority
              />
            </div>
            <p style={{ fontSize: 10, color: "#5A7490", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 14 }}>
              Plataforma Financeira
            </p>
          </div>

          {/* ── Demo badge ── */}
          {IS_DEMO_MODE && (
            <div style={{
              padding: "9px 14px", borderRadius: 10, marginBottom: 24,
              background: "rgba(196,146,46,0.06)", border: "1px solid rgba(196,146,46,0.2)",
              display: "flex", alignItems: "center", gap: 8
            }}>
              <Sparkles style={{ width: 13, height: 13, color: "#E5B96A", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#E5B96A", fontWeight: 500 }}>
                Modo Demo — use os acessos abaixo
              </span>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Email */}
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, color: "#5A7490",
                textTransform: "uppercase", letterSpacing: "0.1em",
                display: "block", marginBottom: 7
              }}>E-mail</label>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#5A7490" }} />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
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

            {/* Password */}
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, color: "#5A7490",
                textTransform: "uppercase", letterSpacing: "0.1em",
                display: "block", marginBottom: 7
              }}>Senha</label>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#5A7490" }} />
                <input
                  type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: "100%", height: 46, paddingLeft: 42, paddingRight: 50,
                    background: "#0F1E35", border: "1px solid #122036", borderRadius: 12,
                    color: "#E8EDF5", fontSize: 14, outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(196,146,46,0.4)"}
                  onBlur={(e) => e.target.style.borderColor = "#122036"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#5A7490", padding: 0
                  }}>
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: "10px 13px", borderRadius: 10,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#F87171", fontSize: 13
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              marginTop: 4, height: 48,
              background: loading
                ? "rgba(196,146,46,0.4)"
                : "linear-gradient(120deg, #C4922E 0%, #E5B96A 50%, #C4922E 100%)",
              backgroundSize: "200% 100%",
              color: "#050C18", border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700, letterSpacing: "0.04em",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading ? "none" : "0 4px 20px rgba(196,146,46,0.35)",
              transition: "all 0.2s",
            }}>
              {loading ? "Entrando..." : (<>Acessar Plataforma <ArrowRight style={{ width: 16, height: 16 }} /></>)}
            </button>
          </form>

          {/* ── Demo quick access ── */}
          {IS_DEMO_MODE && (
            <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(196,146,46,0.12)" }}>
              <p style={{
                fontSize: 10, color: "#5A7490", textAlign: "center",
                marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.12em"
              }}>
                Acesso Rápido — Demo
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Administrador", email: "admin@v3partner.com",   pass: "admin123",   color: "#EF4444" },
                  { label: "Partner",       email: "partner@v3partner.com", pass: "partner123", color: "#C4922E" },
                  { label: "Gestão",        email: "gestao@v3partner.com",  pass: "gestao123",  color: "#10B981" },
                  { label: "Mesa Oper.",    email: "mesa@v3partner.com",    pass: "mesa123",    color: "#8B5CF6" },
                ].map((item) => (
                  <button key={item.email} onClick={() => quickLogin(item.email, item.pass)}
                    style={{
                      padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${item.color}30`, background: `${item.color}0D`,
                      color: item.color, cursor: "pointer", transition: "all 0.15s",
                      letterSpacing: "0.01em",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${item.color}1A`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = `${item.color}0D`)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: "#3A5068", textAlign: "center", marginTop: 10 }}>
                Selecione o perfil e clique em Acessar
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", fontSize: 10, color: "#3A5068", marginTop: 18, letterSpacing: "0.05em" }}>
          © {new Date().getFullYear()} V3 Partners. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Eye, EyeOff, Lock, Mail, ArrowRight, Sparkles } from "lucide-react";
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

    // DEMO MODE
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

    // PRODUCTION MODE (Supabase)
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
      style={{ backgroundColor: "#060D1A" }}>
      {/* Background effects */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(27,79,216,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(27,79,216,0.05) 1px, transparent 1px)",
        backgroundSize: "32px 32px"
      }} />
      <div style={{ position: "absolute", top: "25%", left: "25%", width: 384, height: 384, background: "rgba(27,79,216,0.04)", borderRadius: "50%", filter: "blur(64px)" }} />
      <div style={{ position: "absolute", bottom: "25%", right: "25%", width: 384, height: 384, background: "rgba(212,160,23,0.04)", borderRadius: "50%", filter: "blur(64px)" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 400, margin: "0 16px" }}>
        <div style={{
          background: "#0F172A",
          border: "1px solid rgba(30,41,59,0.8)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
        }}>
          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, #1B4FD8, #D4A017)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(27,79,216,0.3)",
              marginBottom: 12
            }}>
              <TrendingUp style={{ width: 28, height: 28, color: "white" }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>
              V3 PARTNER
            </h1>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Plataforma Financeira</p>
          </div>

          {/* Demo badge */}
          {IS_DEMO_MODE && (
            <div style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 20,
              background: "rgba(27,79,216,0.1)", border: "1px solid rgba(27,79,216,0.3)",
              display: "flex", alignItems: "center", gap: 8
            }}>
              <Sparkles style={{ width: 14, height: 14, color: "#3B6EF8" }} />
              <span style={{ fontSize: 12, color: "#3B6EF8", fontWeight: 500 }}>
                Modo Demo — use os acessos abaixo
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                E-mail
              </label>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#64748B" }} />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  style={{
                    width: "100%", height: 44, paddingLeft: 40, paddingRight: 16,
                    background: "#1E293B", border: "1px solid #1E293B", borderRadius: 12,
                    color: "#E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                Senha
              </label>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#64748B" }} />
                <input
                  type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: "100%", height: 44, paddingLeft: 40, paddingRight: 48,
                    background: "#1E293B", border: "1px solid #1E293B", borderRadius: 12,
                    color: "#E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box"
                  }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              height: 44, background: loading ? "#1B4FD8AA" : "linear-gradient(135deg, #1B4FD8, #1B4FD8CC)",
              color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, transition: "all 0.2s",
              boxShadow: "0 4px 16px rgba(27,79,216,0.3)"
            }}>
              {loading ? "Entrando..." : (<>Entrar <ArrowRight style={{ width: 16, height: 16 }} /></>)}
            </button>
          </form>

          {/* Demo quick access */}
          {IS_DEMO_MODE && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1E293B" }}>
              <p style={{ fontSize: 11, color: "#64748B", textAlign: "center", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Acesso rápido — Demo
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Administrador", email: "admin@v3partner.com", pass: "admin123", color: "#EF4444" },
                  { label: "Partner", email: "partner@v3partner.com", pass: "partner123", color: "#1B4FD8" },
                  { label: "Gestão", email: "gestao@v3partner.com", pass: "gestao123", color: "#F59E0B" },
                  { label: "Mesa Oper.", email: "mesa@v3partner.com", pass: "mesa123", color: "#8B5CF6" },
                ].map((item) => (
                  <button key={item.email} onClick={() => quickLogin(item.email, item.pass)}
                    style={{
                      padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: `1px solid ${item.color}30`, background: `${item.color}10`,
                      color: item.color, cursor: "pointer", transition: "all 0.15s"
                    }}>
                    {item.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#475569", textAlign: "center", marginTop: 10 }}>
                Clique no perfil e depois em Entrar
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 16 }}>
          © {new Date().getFullYear()} V3 Partner. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

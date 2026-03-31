"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";

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

    try {
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

      router.push("/dashboard");
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#050C18" }}>

      {/* Background layers */}
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
      <div style={{
        position: "absolute", bottom: "10%", left: "5%",
        width: 400, height: 400,
        background: "radial-gradient(ellipse, rgba(26,79,196,0.06) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      {/* Card */}
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
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(196,146,46,0.5), transparent)"
          }} />

          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
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

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "#3A5068", marginTop: 18, letterSpacing: "0.05em" }}>
          © {new Date().getFullYear()} V3 Partners. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

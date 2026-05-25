"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  ChevronRight, X, Menu, Check, Plus, ArrowRight,
  TrendingUp, Shield, Zap, BarChart2, PieChart,
  DollarSign, Building2, Globe, Award, Cpu, FileText,
  Users, MapPin, Star, ArrowUpRight,
} from "lucide-react";

// ── Paleta V3 ──────────────────────────────────────────────────────────────
const G  = "#C9A84C";
const G2 = "#E8C97A";
const N  = "#09081A";
const N2 = "#111F35";
const N3 = "#162744";
const N4 = "#243A66";
const CR = "#F0ECE4";
const MT = "#7A8FA8";

// ── useInView ──────────────────────────────────────────────────────────────
function useInView(threshold = 0.12, once = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); if (once) obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);
  return { ref, visible };
}

// ── Reveal ─────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, direction = "up", className = "" }: {
  children: React.ReactNode; delay?: number;
  direction?: "up" | "left" | "right" | "none"; className?: string;
}) {
  const { ref, visible } = useInView();
  const t: Record<string, string> = { up: "translateY(36px)", left: "translateX(-40px)", right: "translateX(40px)", none: "none" };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : t[direction],
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(.22,.68,0,1.2) ${delay}ms`,
    }}>{children}</div>
  );
}

// ── Counter ────────────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", duration = 1800 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; obs.disconnect();
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>;
}

// ── GoldLine ───────────────────────────────────────────────────────────────
function GoldLine() {
  const { ref, visible } = useInView(0.1);
  return <div ref={ref} style={{ width: visible ? 48 : 0, height: 2, background: G, transition: "width 0.55s ease", flexShrink: 0 }} />;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Reveal direction="left">
      <div className="flex items-center gap-3 mb-10">
        <GoldLine />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, color: G, textTransform: "uppercase" as const }}>{children}</span>
      </div>
    </Reveal>
  );
}

// ── CTABtn ─────────────────────────────────────────────────────────────────
function CTABtn({ onClick, children, outline = false, large = false, full = false }: {
  onClick: () => void; children: React.ReactNode; outline?: boolean; large?: boolean; full?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className={`inline-flex items-center justify-center gap-2 font-bold transition-all${full ? " w-full" : ""}`}
      style={{
        background: outline ? "transparent" : hov ? G2 : G,
        color: outline ? (hov ? G2 : G) : N,
        border: `2px solid ${hov ? G2 : G}`,
        padding: large ? "18px 52px" : "13px 32px",
        borderRadius: 3, fontSize: large ? 13 : 12,
        letterSpacing: 2.2, textTransform: "uppercase" as const,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov && !outline ? `0 14px 40px ${G}50` : "none",
        transition: "all 0.22s ease",
      }}>
      {children} <ChevronRight size={14} />
    </button>
  );
}

// ── FAQItem ────────────────────────────────────────────────────────────────
function FAQItem({ n, q, a }: { n: number; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ borderBottom: `1px solid ${N4}`, cursor: "pointer" }}>
      <div className="flex items-start justify-between py-5 gap-4">
        <p style={{ fontWeight: 600, fontSize: 15, color: open ? G : CR, lineHeight: 1.45, transition: "color 0.2s" }}>{n}. {q}</p>
        <div className="flex-shrink-0 mt-0.5" style={{ color: G, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>
          <Plus size={17} />
        </div>
      </div>
      <div style={{ maxHeight: open ? 440 : 0, overflow: "hidden", transition: "max-height 0.4s cubic-bezier(.4,0,.2,1)" }}>
        <p style={{ fontSize: 14, color: MT, lineHeight: 1.9, paddingBottom: 22 }}>{a}</p>
      </div>
    </div>
  );
}

// ── ParallaxOrb ────────────────────────────────────────────────────────────
function ParallaxOrb({ top, left, size, delay, color = G }: {
  top: string; left: string; size: number; delay: number; color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = () => { if (ref.current) ref.current.style.transform = `translateY(${window.scrollY * 0.09 + delay}px)`; };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [delay]);
  return <div ref={ref} style={{ position: "absolute", top, left, width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle, ${color}0D 0%, transparent 70%)`, pointerEvents: "none" }} />;
}

// ── PLATFORM MOCKUP ────────────────────────────────────────────────────────
function PlatformMockup() {
  const { ref, visible } = useInView(0.1);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(40px) scale(0.97)",
      transition: "opacity 0.9s ease 200ms, transform 0.9s cubic-bezier(.22,.68,0,1.2) 200ms",
    }}>
      {/* Browser frame */}
      <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${N4}`, background: N2, boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px ${N4}` }}>
        {/* Browser chrome */}
        <div style={{ background: N3, padding: "10px 16px", borderBottom: `1px solid ${N4}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
          <div style={{ flex: 1, background: N4, borderRadius: 4, padding: "4px 12px", marginLeft: 8 }}>
            <span style={{ fontSize: 10, color: MT }}>v3partners.com.br/dashboard</span>
          </div>
        </div>
        {/* Dashboard layout */}
        <div style={{ display: "flex", height: 340 }}>
          {/* Sidebar */}
          <div style={{ width: 52, background: N, borderRight: `1px solid ${N4}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `${G}20`, border: `1px solid ${G}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart2 size={13} color={G} />
            </div>
            {[Building2, FileText, DollarSign, Globe, Cpu, Users].map((Icon, i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: N3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={12} color={MT} />
              </div>
            ))}
          </div>
          {/* Main area */}
          <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
            {/* Top row KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Pipeline Ativo", value: "R$ 4,2M", up: true },
                { label: "Comissões", value: "R$ 312K", up: true },
                { label: "Operações", value: "23", up: true },
                { label: "Conversão", value: "34%", up: false },
              ].map(({ label, value, up }) => (
                <div key={label} style={{ background: N3, borderRadius: 6, padding: "8px 10px", border: `1px solid ${N4}` }}>
                  <p style={{ fontSize: 8, color: MT, marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 900, color: G, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 7, color: up ? "#10B981" : "#F59E0B", marginTop: 3 }}>{up ? "▲" : "▼"} {up ? "+18%" : "-2%"} vs mês</p>
                </div>
              ))}
            </div>
            {/* Chart area + sidebar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8, marginBottom: 8 }}>
              {/* Fake chart */}
              <div style={{ background: N3, borderRadius: 6, padding: 10, border: `1px solid ${N4}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 8, color: MT, fontWeight: 600 }}>Pipeline M&A + Crédito</p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["1M", "3M", "6M"].map(t => (
                      <span key={t} style={{ fontSize: 7, color: t === "3M" ? G : MT, background: t === "3M" ? `${G}20` : "transparent", padding: "1px 4px", borderRadius: 2 }}>{t}</span>
                    ))}
                  </div>
                </div>
                {/* Bars */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 70 }}>
                  {[45, 60, 40, 80, 55, 95, 70, 85, 100, 72, 88, 65].map((h, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", background: i === 6 ? G : `${G}30`, height: `${h}%`, transition: "height 0.5s ease" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map(m => (
                    <span key={m} style={{ fontSize: 6, color: MT }}>{m}</span>
                  ))}
                </div>
              </div>
              {/* Mini pie + list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ background: N3, borderRadius: 6, padding: 8, border: `1px solid ${N4}`, flex: 1 }}>
                  <p style={{ fontSize: 7, color: MT, marginBottom: 6, fontWeight: 600 }}>Por Vertical</p>
                  {[["M&A", 38, G], ["Crédito", 32, G2], ["Real Estate", 18, "#7A8FA8"], ["Outros", 12, N4]].map(([l, pct, c]) => (
                    <div key={l as string} style={{ marginBottom: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 7, color: MT }}>{l}</span>
                        <span style={{ fontSize: 7, color: c as string, fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: N4 }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: c as string }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Operations list */}
            <div style={{ background: N3, borderRadius: 6, padding: 8, border: `1px solid ${N4}` }}>
              <p style={{ fontSize: 8, color: MT, fontWeight: 600, marginBottom: 6 }}>Operações Recentes</p>
              {[
                ["TechCorp Ltda", "M&A — Aquisição", "R$ 8,4M", "Due Diligence"],
                ["Grupo Aliança", "CGI — Crédito", "R$ 2,1M", "Aprovado"],
                ["Fazenda Nova", "CPR Agro", "R$ 1,6M", "Análise"],
              ].map(([co, op, val, status]) => (
                <div key={co as string} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${N4}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: `${G}15`, border: `1px solid ${G}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={10} color={G} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 8, color: CR, fontWeight: 600 }}>{co}</p>
                    <p style={{ fontSize: 7, color: MT }}>{op}</p>
                  </div>
                  <p style={{ fontSize: 8, fontWeight: 700, color: G }}>{val}</p>
                  <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 10, background: status === "Aprovado" ? "#10B98120" : `${G}15`, color: status === "Aprovado" ? "#10B981" : G, border: `1px solid ${status === "Aprovado" ? "#10B98130" : G + "25"}` }}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Glow */}
      <div style={{ position: "absolute", bottom: -40, left: "50%", transform: "translateX(-50%)", width: "80%", height: 80, background: `radial-gradient(ellipse, ${G}25 0%, transparent 70%)`, pointerEvents: "none" }} />
    </div>
  );
}

// ── MODULE CARD ────────────────────────────────────────────────────────────
function ModuleCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={delay}>
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ background: hov ? `${G}0C` : N3, border: `1px solid ${hov ? G + "40" : N4}`, borderRadius: 10, padding: "22px 20px", transition: "all 0.25s ease", cursor: "default" }}>
        <div style={{ color: hov ? G : MT, marginBottom: 12, transition: "color 0.25s" }}>{icon}</div>
        <p style={{ fontSize: 13, fontWeight: 700, color: hov ? G : CR, marginBottom: 6, transition: "color 0.25s" }}>{title}</p>
        <p style={{ fontSize: 12, color: MT, lineHeight: 1.7 }}>{desc}</p>
      </div>
    </Reveal>
  );
}

// ── PROFILE CARD ───────────────────────────────────────────────────────────
function ProfileCard({ icon, title, desc, delay = 0 }: { icon: string; title: string; desc: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="flex items-start gap-4 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${G}10`, border: `1px solid ${G}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: CR, marginBottom: 5, lineHeight: 1.3 }}>{title}</p>
          <p style={{ fontSize: 13, color: MT, lineHeight: 1.75 }}>{desc}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ── PLAN CARD ──────────────────────────────────────────────────────────────
function PlanCard({ titulo, comissao, tag, featured, items, onClick, delay = 0 }: {
  titulo: string; comissao: string; tag: string | null; featured: boolean;
  items: string[]; onClick: () => void; delay?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={delay}>
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${featured || hov ? G + "55" : N4}`, background: featured ? `${G}0F` : N2, position: "relative", transition: "border-color 0.25s, transform 0.25s", transform: hov ? "translateY(-4px)" : "none" }}>
        {featured && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, ${G2}, ${G})` }} />}
        <div style={{ padding: 28 }}>
          {tag && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: G, background: `${G}20`, border: `1px solid ${G}40`, padding: "4px 12px", borderRadius: 20, display: "inline-block", marginBottom: 14 }}>{tag}</div>}
          <h3 style={{ fontWeight: 900, fontSize: 18, color: featured ? G : CR, marginBottom: 6 }}>{titulo}</h3>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
            <span style={{ fontSize: 42, fontWeight: 900, color: G, lineHeight: 1 }}>{comissao}</span>
            <span style={{ fontSize: 13, color: MT }}>de comissão</span>
          </div>
          <div style={{ borderTop: `1px solid ${N4}`, paddingTop: 20, marginBottom: 24 }}>
            {items.map(it => (
              <div key={it} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: `${G}20`, border: `1px solid ${G}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={9} color={G} />
                </div>
                <p style={{ fontSize: 13, color: MT, lineHeight: 1.5 }}>{it}</p>
              </div>
            ))}
          </div>
          <button onClick={onClick} className="w-full py-3.5 font-bold text-xs transition-all hover:opacity-85"
            style={{ background: featured ? G : "transparent", color: featured ? N : G, border: `1.5px solid ${G}`, borderRadius: 6, letterSpacing: 1.5, textTransform: "uppercase" as const }}>
            Solicitar acesso
          </button>
        </div>
      </div>
    </Reveal>
  );
}

// ── CITY BADGE ─────────────────────────────────────────────────────────────
function CityBadge({ city, state, status, delay = 0 }: { city: string; state: string; status: "ativa" | "abrindo" | "disponivel"; delay?: number }) {
  const c = {
    ativa:      { bg: `${G}15`, border: `${G}40`, dot: G, text: G, label: "Ativa" },
    abrindo:    { bg: `${N4}60`, border: N4, dot: G2, text: CR, label: "Abrindo" },
    disponivel: { bg: N3, border: N4, dot: MT, text: MT, label: "Disponível" },
  }[status];
  return (
    <Reveal delay={delay}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: c.bg, border: `1px solid ${c.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={12} color={c.dot} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: c.text, lineHeight: 1 }}>{city}</p>
            <p style={{ fontSize: 10, color: MT, marginTop: 2 }}>{state}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
          <span style={{ fontSize: 10, color: c.dot, fontWeight: 700 }}>{c.label}</span>
        </div>
      </div>
    </Reveal>
  );
}

// ── MARKET VISUAL ──────────────────────────────────────────────────────────
function MarketVisual() {
  const { ref, visible } = useInView(0.1);
  const bars = [62, 45, 78, 55, 90, 68, 85, 72, 95, 80, 88, 76];
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(40px)",
      transition: "opacity 0.8s ease 200ms, transform 0.8s cubic-bezier(.22,.68,0,1.2) 200ms",
    }}>
      <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${N4}`, background: N2, boxShadow: `0 24px 60px rgba(0,0,0,0.5)` }}>
        {/* Header */}
        <div style={{ background: N3, padding: "14px 20px", borderBottom: `1px solid ${N4}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: CR }}>Mesa de Crédito & M&A</p>
            <p style={{ fontSize: 10, color: MT }}>Pipeline consolidado · Tempo real</p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["N1", "N2", "N3", "M&A"].map((t, i) => (
              <span key={t} style={{ fontSize: 9, fontWeight: 700, color: i === 3 ? G : MT, background: i === 3 ? `${G}20` : N4, padding: "3px 8px", borderRadius: 4 }}>{t}</span>
            ))}
          </div>
        </div>
        {/* Chart */}
        <div style={{ padding: "20px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, marginBottom: 8 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                  <div style={{
                    width: "100%", borderRadius: "3px 3px 0 0",
                    height: `${h}%`,
                    background: i === 10 ? `linear-gradient(180deg, ${G2}, ${G})` : i % 3 === 0 ? `${G}40` : `${G}25`,
                    boxShadow: i === 10 ? `0 0 12px ${G}60` : "none",
                    transition: `height ${0.4 + i * 0.05}s ease`,
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map(m => (
              <span key={m} style={{ fontSize: 8, color: MT }}>{m}</span>
            ))}
          </div>
        </div>
        {/* Bottom metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${N4}` }}>
          {[
            { label: "Volume Total", val: "R$ 42M" },
            { label: "Comissões Pagas", val: "R$ 8,4M" },
            { label: "Partners Ativos", val: "127" },
          ].map(({ label, val }, i) => (
            <div key={label} style={{ padding: "14px 16px", borderRight: i < 2 ? `1px solid ${N4}` : "none" }}>
              <p style={{ fontSize: 9, color: MT, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: G }}>{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FORJA VISUAL ───────────────────────────────────────────────────────────
function ForjaVisual() {
  const { ref, visible } = useInView(0.1);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-40px)",
      transition: "opacity 0.8s ease 200ms, transform 0.8s cubic-bezier(.22,.68,0,1.2) 200ms",
    }}>
      <div style={{ borderRadius: 16, border: `1px solid ${N4}`, background: N2, overflow: "hidden", boxShadow: `0 24px 60px rgba(0,0,0,0.5)` }}>
        {/* Header */}
        <div style={{ background: N3, padding: "14px 20px", borderBottom: `1px solid ${N4}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: `${G}20`, border: `1px solid ${G}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Cpu size={14} color={G} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: CR }}>IA FORJA · Análise em andamento</p>
            <p style={{ fontSize: 9, color: G }}>● Processando — Fase 2 de 2</p>
          </div>
        </div>
        {/* Phases */}
        <div style={{ padding: 20 }}>
          {[
            { phase: "Fase 1", label: "Score & Validação", done: true, pct: 100 },
            { phase: "Fase 2", label: "Narrativa & Tese de Investimento", done: false, pct: 68 },
          ].map(({ phase, label, done, pct }) => (
            <div key={phase} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: done ? `${G}30` : `${N4}`, border: `1px solid ${done ? G : N4}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {done && <Check size={9} color={G} />}
                  </div>
                  <span style={{ fontSize: 11, color: done ? CR : MT, fontWeight: done ? 600 : 400 }}>{phase} · {label}</span>
                </div>
                <span style={{ fontSize: 11, color: G, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: N4 }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: done ? G : `linear-gradient(90deg, ${G}, ${G2})`, boxShadow: done ? "none" : `0 0 8px ${G}60` }} />
              </div>
            </div>
          ))}
          {/* Output preview */}
          <div style={{ background: N3, borderRadius: 8, padding: "12px 14px", marginTop: 8, border: `1px solid ${N4}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: G, letterSpacing: 1.5, marginBottom: 8 }}>SAÍDA GERADA</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Score FORJA", "87/100"],
                ["Tese de Inv.", "Gerada ✓"],
                ["Teaser Cego", "Pronto ✓"],
                ["CIM", "Em geração"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: MT }}>{l}</span>
                  <span style={{ fontSize: 10, color: G, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Matching */}
          <div style={{ background: N3, borderRadius: 8, padding: "12px 14px", marginTop: 8, border: `1px solid ${N4}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: G, letterSpacing: 1.5, marginBottom: 8 }}>TOP INVESTORS MATCH</p>
            {["Fundo A · São Paulo · ✓ Setor", "Fundo B · Rio de Janeiro · ✓ Ticket", "Fundo C · Brasília · ✓ Perfil"].map((inv, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Star size={9} color={G} />
                <span style={{ fontSize: 10, color: MT }}>{inv}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export function LandingPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [formData, setFormData] = useState({
    nome: "", email: "", telefone: "", instagram: "", linkedin: "", segmento: "", plano: "PARTNER_PRO",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const h = () => { setScrolled(window.scrollY > 40); setShowSticky(window.scrollY > 700); };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const go = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.telefone) {
      setFormError("Preencha nome, e-mail e telefone."); return;
    }
    setSending(true); setFormError("");
    try {
      const res = await fetch("/api/parceiro/cadastro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) setSent(true);
      else { const d = await res.json(); setFormError(d.error ?? "Erro ao enviar."); }
    } catch { setFormError("Erro de conexão. Tente novamente."); }
    finally { setSending(false); }
  }

  const NAV = [
    ["A Plataforma", "plataforma"],
    ["Expansão", "expansao"],
    ["Planos", "planos"],
    ["FAQ", "faq"],
  ];

  return (
    <div style={{ background: N, color: CR, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap" rel="stylesheet" />

      {/* ── STICKY BAR ──────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(9,8,26,0.97)", backdropFilter: "blur(24px)",
        borderTop: `1px solid ${N4}`,
        transform: showSticky ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.4s cubic-bezier(.4,0,.2,1)",
      }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <p style={{ fontSize: 13, fontWeight: 600, color: CR }} className="hidden sm:block">
            V3 Partners · Expansão Nacional 2026 —{" "}
            <span style={{ color: G }}>vagas abertas por região.</span>
          </p>
          <button onClick={() => go("form")}
            className="flex items-center gap-2 font-bold ml-auto transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "10px 28px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Garantir minha vaga <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        background: scrolled ? "rgba(9,8,26,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? `1px solid ${N4}` : "none",
        transition: "all 0.3s ease",
      }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between" style={{ height: 72 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image src="/logo.jpg" alt="V3 Partners" width={36} height={36} style={{ borderRadius: 8 }} />
            <div>
              <span style={{ fontWeight: 900, fontSize: 12, color: G, letterSpacing: 3.5, display: "block" }}>V3 PARTNERS</span>
              <span style={{ fontSize: 9, color: MT, letterSpacing: 2, display: "block", lineHeight: 1 }}>BOUTIQUE INSTITUCIONAL</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {NAV.map(([l, id]) => (
              <button key={id} onClick={() => go(id)} style={{ fontSize: 12, fontWeight: 500, color: MT, letterSpacing: 0.5 }} className="hover:text-white transition-colors">{l}</button>
            ))}
          </div>
          <button onClick={() => go("form")} className="hidden md:flex items-center gap-2 font-bold hover:opacity-85 transition-all"
            style={{ background: G, color: N, padding: "9px 22px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Seja Partner
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CR }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4" style={{ background: "rgba(9,8,26,0.99)", borderTop: `1px solid ${N4}` }}>
            {[...NAV, ["Seja Partner", "form"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="block w-full text-left py-3.5 text-sm font-medium" style={{ color: CR, borderBottom: `1px solid ${N4}` }}>{l}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          01 · HERO — Statement máximo
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: N, position: "relative", overflow: "hidden" }}>
        {/* Grid bg */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${N4}14 1px, transparent 1px), linear-gradient(to right, ${N4}14 1px, transparent 1px)`, backgroundSize: "72px 72px", opacity: 0.5 }} />
        {/* Gold top line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        {/* Orbs */}
        <ParallaxOrb top="0%"   left="55%" size={900} delay={0} />
        <ParallaxOrb top="60%"  left="-5%" size={500} delay={18} />
        <ParallaxOrb top="75%"  left="78%" size={320} delay={8} />
        {/* Vignette */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 85% 85% at 50% 50%, transparent 25%, ${N} 100%)`, pointerEvents: "none" }} />

        <div className="max-w-6xl mx-auto px-6 relative w-full" style={{ paddingTop: 160, paddingBottom: 80 }}>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left — copy */}
            <div>
              <Reveal direction="none">
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${G}12`, border: `1px solid ${G}30`, borderRadius: 40, padding: "6px 20px", marginBottom: 28 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: G, boxShadow: `0 0 8px ${G}` }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>EXPANSÃO NACIONAL 2026 · VAGAS ABERTAS</span>
                </div>
              </Reveal>

              <Reveal direction="up" delay={80}>
                <h1 style={{ fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 900, lineHeight: 1.02, color: CR, letterSpacing: -1.5, marginBottom: 0 }}>
                  Seja o Partner V3
                </h1>
              </Reveal>
              <Reveal direction="up" delay={150}>
                <h1 style={{ fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.5, marginBottom: 0 }}>
                  <span style={{ background: `linear-gradient(125deg, ${G} 0%, ${G2} 55%, ${G} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    da sua cidade.
                  </span>
                </h1>
              </Reveal>
              <Reveal direction="up" delay={220}>
                <p style={{ fontSize: "clamp(16px, 1.7vw, 19px)", color: MT, lineHeight: 1.85, maxWidth: 560, marginBottom: 14, marginTop: 24 }}>
                  A V3 Partners está em expansão nacional. Licenciamos um único Partner por praça — com acesso exclusivo à nossa plataforma institucional de crédito estruturado, M&A e soluções financeiras high ticket.
                </p>
                <p style={{ fontSize: "clamp(15px, 1.4vw, 17px)", color: `${CR}80`, lineHeight: 1.75, maxWidth: 540, marginBottom: 44, fontStyle: "italic" }}>
                  Você origina. A V3 estrutura, opera e paga comissões de 30% a 50% por operação.
                </p>
              </Reveal>

              <Reveal direction="up" delay={300}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 48 }}>
                  <CTABtn onClick={() => go("form")} large>Garantir minha vaga</CTABtn>
                  <CTABtn onClick={() => go("plataforma")} outline large>Ver a plataforma</CTABtn>
                </div>
              </Reveal>

              {/* Mini trust row */}
              <Reveal direction="up" delay={380}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  {[
                    [Shield, "Boutique institucional"],
                    [Award, "Exclusividade por praça"],
                    [TrendingUp, "30% a 50% de comissão"],
                  ].map(([Icon, text]) => (
                    <div key={text as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={13} color={G} />
                      <span style={{ fontSize: 12, color: MT, fontWeight: 500 }}>{text as string}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right — Platform mockup */}
            <div style={{ position: "relative" }}>
              <PlatformMockup />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20">
            {[
              { n: 50,  suf: "%",  pre: "até ",  label: "de comissão por operação" },
              { n: 400, suf: "K+", pre: "R$",    label: "por operação possível" },
              { n: 10,  suf: "+",  pre: "",       label: "módulos na plataforma" },
              { n: 27,  suf: "",   pre: "",       label: "estados em expansão" },
            ].map(({ n, suf, label, pre }, i) => (
              <Reveal key={label} delay={420 + i * 65}>
                <div style={{ background: "rgba(17,31,53,0.85)", border: `1px solid ${N4}`, borderRadius: 14, padding: "22px", textAlign: "center", backdropFilter: "blur(16px)" }}>
                  <p style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                    {pre}<Counter to={n} suffix={suf} />
                  </p>
                  <p style={{ fontSize: 11, color: MT, marginTop: 6, lineHeight: 1.4 }}>{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CREDIBILITY BAR ─────────────────────────────────────────────── */}
      <div style={{ background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}`, padding: "18px 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "20px 48px" }}>
            {[
              ["🏛️", "Boutique multiproduto"],
              ["📈", "Crédito · M&A · Securitização"],
              ["🤖", "IA FORJA proprietária"],
              ["⚖️", "Compliance e KYC integrados"],
              ["🔒", "Plataforma SaaS exclusiva"],
              ["📜", "CNPJ 14.219.287/0001-50"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>{icon}</span>
                <span style={{ fontSize: 11, color: MT, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          02 · QUEM É A V3 — Identidade institucional
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 55% 50% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-6xl mx-auto px-6 relative">
          <SectionLabel>Quem é a V3 Partners</SectionLabel>
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div>
              <Reveal direction="left">
                <h2 style={{ fontSize: "clamp(26px, 4vw, 50px)", fontWeight: 900, color: CR, lineHeight: 1.15, marginBottom: 24 }}>
                  Uma boutique financeira institucional construída para{" "}
                  <span style={{ color: G }}>operar onde os bancos não chegam.</span>
                </h2>
              </Reveal>
              <Reveal direction="left" delay={100}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  Fundada por <strong style={{ color: CR }}>Hamilton Santos</strong> (finanças e cross-border), <strong style={{ color: CR }}>João Lemos Netto</strong> (originação e ativos) e <strong style={{ color: CR }}>Robson Lino</strong> (compliance e operações), a V3 Partners é uma boutique multiproduto especializada em operações que o mercado convencional não estrutura.
                </p>
              </Reveal>
              <Reveal direction="left" delay={180}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 40 }}>
                  Crédito estruturado de alto valor, M&A para empresas que crescem ou precisam de capital, securitização de recebíveis, real estate e operações internacionais. Tudo com análise institucional, compliance robusto e tecnologia proprietária.
                </p>
              </Reveal>
              <Reveal delay={260}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    ["3", "sócios especialistas"],
                    ["4", "verticais de receita"],
                    ["7", "squads de IA"],
                    ["10+", "módulos integrados"],
                  ].map(([val, label]) => (
                    <div key={label} style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: "16px 18px" }}>
                      <p style={{ fontSize: 28, fontWeight: 900, color: G, lineHeight: 1 }}>{val}</p>
                      <p style={{ fontSize: 12, color: MT, marginTop: 4 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            {/* Right — market visual */}
            <MarketVisual />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          03 · PLATAFORMA — O que o Partner tem nas mãos
      ═══════════════════════════════════════════════════════════════ */}
      <section id="plataforma" style={{ background: N2, padding: "120px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel>A Plataforma V3</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 46px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 16, maxWidth: 820 }}>
              Quando você se torna Partner V3, uma plataforma institucional completa fica nas suas mãos.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.85, maxWidth: 720, marginBottom: 60 }}>
              Não é um CRM simples. É um SaaS proprietário com módulos integrados de crédito, M&A, academy, IA, marketplace, comissões e compliance — tudo desenhado para você operar no nível das maiores boutiques do Brasil.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            <ModuleCard delay={0}   icon={<BarChart2 size={22} />}   title="Dashboard & KPIs em Tempo Real"        desc="Acompanhe seu pipeline, comissões, operações e metas em um painel centralizado. Dados ao vivo de cada negócio." />
            <ModuleCard delay={60}  icon={<Building2 size={22} />}   title="Mesa de Crédito — 3 Níveis"            desc="N1 (varejo), N2 (estruturado) e N3 (high ticket acima de R$5M). Mesa dedicada por nível com análise institucional." />
            <ModuleCard delay={120} icon={<Cpu size={22} />}         title="Mesa M&A + IA FORJA"                   desc="IA proprietária para análise, scoring, narrativa de investimento, teaser cego, CIM e matching de investidores." />
            <ModuleCard delay={180} icon={<FileText size={22} />}    title="Deal Rooms & VDR"                      desc="Workspaces persistentes por deal com Virtual Data Room, upload de documentos e histórico completo." />
            <ModuleCard delay={240} icon={<Users size={22} />}       title="CRM Integrado"                         desc="Gestão completa de contatos, leads, follow-ups e histórico. Todos os seus clientes em um único lugar." />
            <ModuleCard delay={300} icon={<Globe size={22} />}       title="Marketplace de Produtos"              desc="Acesso ao catálogo de soluções financeiras e produtos curados para oferecer à sua carteira de clientes." />
            <ModuleCard delay={360} icon={<Award size={22} />}       title="Academy V3"                           desc="Trilha de capacitação completa. Treinamentos, certificados, materiais de apoio e atualização contínua." />
            <ModuleCard delay={420} icon={<DollarSign size={22} />}  title="Comissões & Relatórios"               desc="Rastreamento em tempo real de cada operação. Relatórios de comissão, histórico de pagamentos e projeções." />
            <ModuleCard delay={480} icon={<Shield size={22} />}      title="Compliance & KYC"                     desc="Módulo integrado de conformidade, análise de risco, trilha de auditoria e gestão de documentos por operação." />
          </div>

          {/* FORJA feature highlight */}
          <div className="grid md:grid-cols-2 gap-16 items-center mt-4">
            <ForjaVisual />
            <div>
              <Reveal direction="right">
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${G}12`, border: `1px solid ${G}25`, borderRadius: 40, padding: "4px 14px", marginBottom: 20 }}>
                  <Cpu size={11} color={G} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: G }}>IA FORJA · EXCLUSIVO V3</span>
                </div>
              </Reveal>
              <Reveal direction="right" delay={80}>
                <h3 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 800, color: CR, lineHeight: 1.25, marginBottom: 20 }}>
                  A IA mais avançada do mercado para estruturação de M&A.
                </h3>
              </Reveal>
              <Reveal direction="right" delay={160}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  A FORJA é nossa IA proprietária de 2 fases. Na Fase 1, analisa o deal e gera um score institucional com validação completa. Na Fase 2, produz a narrativa de investimento, tese, teaser cego e CIM — documentos que as maiores boutiques cobram R$80K para entregar.
                </p>
              </Reveal>
              <Reveal direction="right" delay={220}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 32 }}>
                  Como Partner V3, você usa a FORJA com seus clientes — entregando material de M&A de qualidade institucional sem precisar de uma equipe de analistas.
                </p>
              </Reveal>
              <Reveal direction="right" delay={280}>
                <CTABtn onClick={() => go("form")}>Quero acesso à plataforma</CTABtn>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          04 · O QUE FAZEMOS — Verticais
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-6xl mx-auto px-6 relative">
          <SectionLabel>O que fazemos</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 16, maxWidth: 800 }}>
              Quatro verticais de alto valor. Um portfólio que o mercado convencional não distribui.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.85, maxWidth: 720, marginBottom: 60 }}>
              Cada vertical foi escolhida por uma razão: ticket elevado, margem institucional e demanda real de empresas que não encontram esse tipo de solução nos bancos de varejo.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6 mb-14">
            {[
              {
                num: "01",
                icon: <DollarSign size={22} />,
                title: "Securitização de Crédito e Recebíveis",
                desc: "CGI, precatórios, CRI, FIDC, Home Equity, Crédito Agro. Operações a partir de R$200K com análise institucional completa e colocação junto a fundos qualificados.",
                tags: ["CGI", "FIDC", "CRI", "Precatórios", "Home Equity", "Agro"],
                delay: 0,
              },
              {
                num: "02",
                icon: <Building2 size={22} />,
                title: "M&A — Fusões, Aquisições e Reestruturações",
                desc: "Compra, venda e fusão de empresas com análise estratégica via IA FORJA. Deal Rooms, teaser cego, CIM e matching com investidores institucionais e fundos.",
                tags: ["Valuation", "Teaser", "CIM", "Deal Rooms", "Matching IA"],
                delay: 80,
              },
              {
                num: "03",
                icon: <Globe size={22} />,
                title: "Real Estate Estruturado e Cross-Border",
                desc: "SLB, BTS, BTR, fundos imobiliários e operações internacionais com capital global. Estruturas que o corretor e o banco de varejo não conseguem entregar.",
                tags: ["SLB", "BTS", "BTR", "Fundos", "Cross-Border", "OTC"],
                delay: 160,
              },
              {
                num: "04",
                icon: <TrendingUp size={22} />,
                title: "Mineração, Commodities e Operações Distressed",
                desc: "Lítio, ouro, metais preciosos, operações para empresas com restrição e reestruturações. Soluções onde o mercado fecha a porta e a V3 abre uma janela.",
                tags: ["Ouro", "Lítio", "Commodities", "Distressed", "Split Fiscal"],
                delay: 240,
              },
            ].map(({ num, icon, title, desc, tags, delay }) => (
              <Reveal key={num} delay={delay}>
                <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "28px 28px 20px", borderBottom: `1px solid ${N4}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                      <span style={{ fontSize: 56, fontWeight: 900, color: `${G}18`, lineHeight: 1, letterSpacing: -2 }}>{num}</span>
                      <div style={{ color: G, flexShrink: 0, marginTop: 4 }}>{icon}</div>
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: 18, color: CR, lineHeight: 1.3, marginBottom: 12 }}>{title}</h3>
                    <p style={{ fontSize: 14, color: MT, lineHeight: 1.8 }}>{desc}</p>
                  </div>
                  <div style={{ padding: "14px 28px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, color: G, background: `${G}12`, border: `1px solid ${G}25`, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <CTABtn onClick={() => go("form")}>Quero distribuir essas soluções</CTABtn>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          05 · PERFIL — Quem é o Partner V3
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "120px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel>Perfil do Partner V3</SectionLabel>
          <div className="grid md:grid-cols-2 gap-20 items-start">
            <div>
              <Reveal direction="left">
                <h2 style={{ fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 20 }}>
                  Você não precisa ser do mercado financeiro. Precisa ter o perfil certo.
                </h2>
              </Reveal>
              <Reveal direction="left" delay={100}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 32 }}>
                  Os melhores Partners V3 não são os que mais conhecem de finanças. São os que têm relacionamento com empresários, executivos e tomadores de decisão — e a inteligência de conectar problemas às soluções certas.
                </p>
              </Reveal>
              <Reveal delay={180}>
                <div style={{ background: `${G}0C`, border: `1px solid ${G}25`, borderRadius: 12, padding: "20px 24px", marginBottom: 36 }}>
                  <p style={{ fontSize: "clamp(16px, 2vw, 20px)", fontWeight: 700, color: CR, lineHeight: 1.6, margin: 0 }}>
                    A principal qualificação:{" "}
                    <span style={{ color: G }}>a disposição de trazer negócios à mesa.</span>{" "}
                    O resto, a V3 ensina.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={240}>
                <CTABtn onClick={() => go("form")}>Esse sou eu — quero me candidatar</CTABtn>
              </Reveal>
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <ProfileCard delay={0}   icon="💼" title="Consultores e advisors financeiros" desc="Que querem ampliar o portfólio com produtos institucionais — crédito estruturado, M&A e securitização com ticket e comissão compatíveis com seu nível de atuação." />
              <ProfileCard delay={60}  icon="📊" title="Contadores, CFOs e gestores financeiros" desc="Com acesso direto à realidade financeira das empresas. Sabem antes de qualquer outro quando a empresa precisa de crédito, capital ou reestruturação." />
              <ProfileCard delay={120} icon="⚖️" title="Advogados empresariais e societários" desc="Que acompanham fusões, aquisições, reestruturações e processos que invariavelmente envolvem capital, M&A e operações estruturadas." />
              <ProfileCard delay={180} icon="🏛️" title="Correspondentes bancários" desc="Que querem liberdade operacional, produtos mais inteligentes e comissões muito superiores às que o modelo bancário convencional oferece." />
              <ProfileCard delay={240} icon="🏗️" title="Corretores de imóveis comerciais e de alto padrão" desc="Cujos clientes são empresários e investidores que precisam de estruturação financeira — não só de financiamento de varejo." />
              <ProfileCard delay={300} icon="🚀" title="Empreendedores e executivos em transição" desc="Que querem construir uma carreira independente no mercado financeiro com a credencial e a estrutura de uma boutique institucional." />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          06 · COMO FUNCIONA — Divisão clara
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 55% 50% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <ParallaxOrb top="10%" left="80%" size={500} delay={5} />
        <div className="max-w-6xl mx-auto px-6 relative">
          <SectionLabel>Como funciona a parceria</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 56, maxWidth: 700 }}>
              Você origina. A V3 estrutura e opera. Você recebe.
            </h2>
          </Reveal>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5 mb-16">
            {[
              { n: "01", title: "Licencie-se", body: "Escolha seu plano, assine digitalmente e acesse a plataforma em até 24h. Onboarding guiado pela equipe V3." },
              { n: "02", title: "Capacite-se", body: "Complete o Academy V3. Materiais, treinamentos semanais com a mesa, suporte operacional desde o primeiro dia." },
              { n: "03", title: "Origine negócios", body: "Você identifica oportunidades na sua rede. A V3 analisa, estrutura, conduz compliance e fecha institucionalmente." },
              { n: "04", title: "Receba a comissão", body: "30% ou 50% do resultado líquido, rastreado em tempo real na plataforma e pago após liquidação da operação." },
            ].map(({ n, title, body }, i) => (
              <Reveal key={n} delay={i * 90}>
                <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 12, padding: "28px 24px", height: "100%" }}>
                  <div style={{ fontSize: "clamp(52px, 6vw, 66px)", fontWeight: 900, color: `${G}18`, lineHeight: 1, marginBottom: 16, letterSpacing: -2 }}>{n}</div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: G, marginBottom: 10 }}>{title}</p>
                  <p style={{ fontSize: 13, color: MT, lineHeight: 1.8 }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Division table */}
          <Reveal delay={300}>
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${N4}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${N4}` }}>
                <div style={{ background: N3, borderRight: `1px solid ${N4}`, padding: "14px 24px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: MT }}>VOCÊ FAZ</p>
                </div>
                <div style={{ background: `${G}0C`, padding: "14px 24px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: G }}>A V3 FAZ</p>
                </div>
              </div>
              {[
                ["Prospecta e identifica oportunidades", "Analisa viabilidade e estrutura a operação"],
                ["Apresenta o produto ao cliente", "Conduz compliance, KYC e due diligence"],
                ["Qualifica e coleta documentos iniciais", "Negocia com fundos e instituições financeiras"],
                ["Acompanha o relacionamento com o cliente", "Garante qualidade e padrão institucional"],
                ["Participa das reuniões estratégicas", "Opera como mandatária e emite documentos"],
                ["Recebe 30% a 50% do resultado", "Fecha, liquida e paga a comissão"],
              ].map(([voce, v3], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: i < 5 ? `1px solid ${N4}` : "none" }}>
                  <div style={{ background: N3, borderRight: `1px solid ${N4}`, padding: "14px 24px" }}>
                    <p style={{ fontSize: 13, color: MT }}>{voce}</p>
                  </div>
                  <div style={{ background: `${G}06`, padding: "14px 24px" }}>
                    <p style={{ fontSize: 13, color: CR, fontWeight: 500 }}>{v3}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={360}>
            <div style={{ marginTop: 40 }}>
              <CTABtn onClick={() => go("form")}>Começar agora</CTABtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          07 · EXPANSÃO — Mapa de cidades
      ═══════════════════════════════════════════════════════════════ */}
      <section id="expansao" style={{ background: N2, padding: "120px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel>Expansão nacional 2026</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Reveal direction="left">
                <h2 style={{ fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 20 }}>
                  Uma praça. Um Partner. Exclusividade garantida.
                </h2>
              </Reveal>
              <Reveal direction="left" delay={100}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  Cada cidade opera com um único representante V3 licenciado. Quando sua praça está ativa, todos os leads e indicações originados na região são direcionados para você. Nenhum outro Partner pode atuar na mesma praça.
                </p>
              </Reveal>
              <Reveal direction="left" delay={180}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 32 }}>
                  Estamos mapeando o Brasil inteiro. As vagas das principais praças estão abertas agora — e fecham quando são preenchidas.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
                  {[
                    { dot: G,  label: "Ativa" },
                    { dot: G2, label: "Abrindo" },
                    { dot: MT, label: "Disponível" },
                  ].map(({ dot, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: N3, border: `1px solid ${N4}`, borderRadius: 20, padding: "5px 12px" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />
                      <span style={{ fontSize: 11, color: MT, fontWeight: 500 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={280}>
                <div style={{ background: `${G}0A`, border: `1px solid ${G}22`, borderRadius: 10, padding: "16px 20px", marginBottom: 32 }}>
                  <p style={{ fontSize: 13, color: MT, lineHeight: 1.7 }}>
                    <strong style={{ color: CR }}>Sua cidade não está na lista?</strong>{" "}
                    Sem problema. Preencha o formulário com sua cidade e nossa equipe avalia a abertura da praça com você.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={320}>
                <CTABtn onClick={() => go("form")}>Verificar minha praça</CTABtn>
              </Reveal>
            </div>

            {/* City grids */}
            <div>
              <Reveal direction="right">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 12 }}>SUDESTE</p>
              </Reveal>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
                <CityBadge delay={0}   city="São Paulo"      state="SP" status="ativa"      />
                <CityBadge delay={50}  city="Rio de Janeiro" state="RJ" status="abrindo"    />
                <CityBadge delay={100} city="Belo Horizonte" state="MG" status="abrindo"    />
                <CityBadge delay={150} city="Campinas"       state="SP" status="disponivel" />
                <CityBadge delay={200} city="Ribeirão Preto" state="SP" status="disponivel" />
                <CityBadge delay={250} city="Vitória"        state="ES" status="disponivel" />
              </div>
              <Reveal direction="right" delay={80}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 12 }}>SUL · CENTRO-OESTE</p>
              </Reveal>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
                <CityBadge delay={0}   city="Curitiba"     state="PR" status="abrindo"    />
                <CityBadge delay={50}  city="Porto Alegre" state="RS" status="disponivel" />
                <CityBadge delay={100} city="Brasília"     state="DF" status="abrindo"    />
                <CityBadge delay={150} city="Florianópolis" state="SC" status="disponivel" />
              </div>
              <Reveal direction="right" delay={120}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 12 }}>NORTE · NORDESTE</p>
              </Reveal>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <CityBadge delay={0}   city="Salvador"  state="BA" status="abrindo"    />
                <CityBadge delay={50}  city="Fortaleza" state="CE" status="disponivel" />
                <CityBadge delay={100} city="Recife"    state="PE" status="disponivel" />
                <CityBadge delay={150} city="Manaus"    state="AM" status="disponivel" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          08 · PLANOS — Modalidades sem valores
      ═══════════════════════════════════════════════════════════════ */}
      <section id="planos" style={{ background: N, padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-6xl mx-auto px-6 relative">
          <SectionLabel>Modalidades de licenciamento</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 16, maxWidth: 760 }}>
              Três modalidades. Você escolhe o nível que faz sentido agora — e evolui conforme cresce.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.85, maxWidth: 660, marginBottom: 56 }}>
              Cada modalidade dá acesso a um conjunto específico de ferramentas e verticais da V3. Sem compromisso de longo prazo. A conversa sobre condições e investimento acontece no contato com nossa equipe.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <PlanCard
              delay={0} titulo="V3 Partner Entry" comissao="30%" tag={null} featured={false}
              onClick={() => go("form")}
              items={[
                "Crédito N1 e N2 (até R$5M)",
                "Plataforma V3 com CRM integrado",
                "Academy V3 — módulo base",
                "Chat com a mesa de crédito",
                "Suporte operacional semanal",
                "30% de comissão por operação",
              ]}
            />
            <PlanCard
              delay={100} titulo="V3 Partner" comissao="30%" tag="Mais escolhido" featured={true}
              onClick={() => go("form")}
              items={[
                "Crédito N1, N2 e N3 (acima de R$5M)",
                "Mesa de crédito completa",
                "Consórcio corporativo",
                "Relatórios e KPIs avançados",
                "Academy V3 — trilha completa",
                "30% de comissão por operação",
              ]}
            />
            <PlanCard
              delay={200} titulo="V3 Partner PRO" comissao="50%" tag={null} featured={false}
              onClick={() => go("form")}
              items={[
                "Tudo do Partner +",
                "Mesa M&A dedicada + IA FORJA",
                "Deal Rooms e VDR exclusivo",
                "Co-branding V3 Partners",
                "Academy M&A avançado",
                "50% de comissão por operação",
              ]}
            />
          </div>

          <Reveal delay={320}>
            <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ fontSize: 20, flexShrink: 0 }}>📍</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: CR, marginBottom: 4 }}>Vaga única por praça · Exclusividade garantida</p>
                <p style={{ fontSize: 13, color: MT, lineHeight: 1.7 }}>
                  O programa é seletivo e territorial. Uma praça — um Partner. Leads e indicações da sua região são direcionados exclusivamente para você. Quando a vaga fecha, fecha definitivamente. O investimento de entrada e as condições são apresentadas pela nossa equipe no contato inicial.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          09 · QUOTE + CTA Urgência
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <ParallaxOrb top="0%"  left="5%"  size={600} delay={0} />
        <ParallaxOrb top="20%" left="78%" size={400} delay={10} />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <Reveal>
            <div style={{ fontSize: 64, color: `${G}35`, lineHeight: 1, marginBottom: 28, fontFamily: "Georgia, serif" }}>"</div>
            <p style={{ fontSize: "clamp(22px, 3.5vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.35, marginBottom: 24 }}>
              O mercado financeiro institucional sempre existiu. O que mudou é que agora você pode entrar nele — com estrutura, tecnologia e credencial — sem precisar montar uma boutique do zero.
            </p>
            <div style={{ width: 48, height: 2, background: G, margin: "0 auto 24px" }} />
            <p style={{ fontSize: 12, color: MT, fontWeight: 600, letterSpacing: 2 }}>V3 PARTNERS · BOUTIQUE INSTITUCIONAL · EXPANSÃO 2026</p>
          </Reveal>
          <Reveal delay={160}>
            <div style={{ marginTop: 56 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${G}12`, border: `1px solid ${G}30`, borderRadius: 40, padding: "7px 20px", marginBottom: 28 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: G, boxShadow: `0 0 8px ${G}` }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>VAGAS ABERTAS · EXPANSÃO 2026</span>
              </div>
              <h3 style={{ fontSize: "clamp(26px, 4vw, 52px)", fontWeight: 900, color: CR, lineHeight: 1.1, marginBottom: 18, letterSpacing: -1 }}>
                Sua cidade tem uma vaga.
                <br />
                <span style={{ color: G }}>Depende de você ocupar.</span>
              </h3>
              <p style={{ fontSize: "clamp(15px, 1.7vw, 18px)", color: MT, lineHeight: 1.85, marginBottom: 40, maxWidth: 620, margin: "0 auto 40px" }}>
                Quando a vaga da sua praça fechar, a próxima oportunidade de entrar depende de uma desistência. Não espere para decidir.
              </p>
              <CTABtn onClick={() => go("form")} large>Garantir minha praça agora</CTABtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          10 · FAQ
      ═══════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: N, padding: "120px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel>Perguntas frequentes</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Reveal>
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 20 }}>
                  Tire suas dúvidas antes de decidir.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.85, marginBottom: 36 }}>
                  Se sua dúvida não estiver aqui, nossa equipe responde em até 24h úteis após você preencher o formulário.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <CTABtn onClick={() => go("form")}>Falar com a equipe</CTABtn>
              </Reveal>
            </div>
            <Reveal direction="right">
              <div style={{ borderTop: `1px solid ${N4}` }}>
                {[
                  { q: "O que significa exclusividade de praça?", a: "Cada cidade opera com um único Partner V3 ativo. Quando você licencia sua praça, todos os leads e indicações originados naquela região são direcionados para você. Nenhum outro Partner pode atuar na mesma praça enquanto o contrato estiver ativo." },
                  { q: "Preciso de experiência no mercado financeiro?", a: "Não é obrigatório. A principal qualificação é a disposição de trazer negócios à mesa e o relacionamento com empresários e tomadores de decisão. A V3 oferece a capacitação técnica pelo Academy V3, com suporte prático desde o primeiro dia." },
                  { q: "Qual o potencial real de ganho como Partner?", a: "Depende do volume e dos produtos que você origina. Em crédito estruturado, um Partner ativo pode gerar R$30K a R$120K mensais. Em M&A, uma única operação acima de R$10M pode gerar de R$200K a R$400K em comissão única." },
                  { q: "Quanto tempo até a primeira comissão?", a: "Em crédito estruturado, o ciclo médio é de 30 a 90 dias. Em operações de split fiscal pode ser mais rápido. Em M&A, de 3 a 12 meses. A plataforma rastreia o status de cada operação em tempo real, com transparência total." },
                  { q: "Posso manter minha profissão atual?", a: "Sim. A parceria V3 é não exclusiva. Você pode manter todas as suas atividades profissionais. A plataforma foi projetada para uso assíncrono — você opera no seu ritmo, no seu horário, sem exigência de dedicação exclusiva." },
                  { q: "Qual a diferença entre Partner e Partner PRO?", a: "O Partner PRO tem comissão de 50% (vs 30%), acesso à Mesa M&A com IA FORJA, Deal Rooms com VDR, co-branding V3 Partners e Academy M&A avançado. Também opera em crédito N3 (acima de R$5M) com mais suporte dedicado." },
                  { q: "Como é o suporte da V3 nas operações?", a: "A mesa operacional da V3 acompanha cada operação. Você origina o cliente, participa das reuniões estratégicas e conta com o respaldo institucional da V3 — da análise à liquidação. Você nunca opera sozinho." },
                  { q: "Como são pagas as comissões?", a: "Sua comissão é rastreada em tempo real na plataforma, por operação e por status. O pagamento acontece após a liquidação da operação, de forma transparente e auditável diretamente no seu painel." },
                ].map(({ q, a }, i) => <FAQItem key={q} n={i + 1} q={q} a={a} />)}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          11 · FORMULÁRIO
      ═══════════════════════════════════════════════════════════════ */}
      <section id="form" style={{ background: N2, padding: "120px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 0%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-2xl mx-auto px-6 relative">
          <SectionLabel>Solicitar licenciamento</SectionLabel>

          {sent ? (
            <Reveal>
              <div style={{ background: N3, border: `1px solid ${G}40`, borderRadius: 16, padding: "56px 40px", textAlign: "center" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${G}15`, border: `1px solid ${G}35`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                  <Check size={32} color={G} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 26, color: CR, marginBottom: 14 }}>Solicitação recebida!</h3>
                <p style={{ color: MT, fontSize: 15, lineHeight: 1.85 }}>
                  Obrigado, <strong style={{ color: CR }}>{formData.nome}</strong>! Nossa equipe de Expansão V3 vai entrar em contato pelo e-mail{" "}
                  <strong style={{ color: G }}>{formData.email}</strong> em até 24 horas úteis para verificar a disponibilidade da sua praça e apresentar o programa completo.
                </p>
              </div>
            </Reveal>
          ) : (
            <>
              <Reveal>
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 36px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 14 }}>
                  Preencha abaixo. Nossa equipe verifica sua praça e entra em contato.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.8, marginBottom: 36 }}>
                  Não é uma compra online. É um processo seletivo. Vamos entender seu perfil, verificar a disponibilidade da sua praça e apresentar o programa completo antes de qualquer decisão.
                </p>
              </Reveal>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Reveal direction="up" delay={120}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>NOME COMPLETO *</label>
                    <input type="text" value={formData.nome} onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))}
                      placeholder="Seu nome completo" required
                      className="w-full focus:outline-none transition-all"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 5, color: CR, padding: "14px 18px", fontSize: 14 }} />
                  </div>
                </Reveal>
                <Reveal direction="up" delay={150}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>E-MAIL *</label>
                      <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                        placeholder="seu@email.com" required className="w-full focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 5, color: CR, padding: "14px 18px", fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>WHATSAPP *</label>
                      <input type="tel" value={formData.telefone} onChange={e => setFormData(f => ({ ...f, telefone: e.target.value }))}
                        placeholder="(11) 99999-9999" required className="w-full focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 5, color: CR, padding: "14px 18px", fontSize: 14 }} />
                    </div>
                  </div>
                </Reveal>
                <Reveal direction="up" delay={180}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>CIDADE E ESTADO *</label>
                    <input type="text" value={formData.segmento} onChange={e => setFormData(f => ({ ...f, segmento: e.target.value }))}
                      placeholder="Ex: Campinas - SP, Porto Alegre - RS, Fortaleza - CE..."
                      className="w-full focus:outline-none"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 5, color: CR, padding: "14px 18px", fontSize: 14 }} />
                  </div>
                </Reveal>
                <Reveal direction="up" delay={200}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>INSTAGRAM</label>
                      <input type="text" value={formData.instagram} onChange={e => setFormData(f => ({ ...f, instagram: e.target.value }))}
                        placeholder="@seuperfil" className="w-full focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 5, color: CR, padding: "14px 18px", fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>LINKEDIN</label>
                      <input type="text" value={formData.linkedin} onChange={e => setFormData(f => ({ ...f, linkedin: e.target.value }))}
                        placeholder="linkedin.com/in/..." className="w-full focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 5, color: CR, padding: "14px 18px", fontSize: 14 }} />
                    </div>
                  </div>
                </Reveal>

                <Reveal direction="up" delay={220}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 10 }}>MODALIDADE DE INTERESSE</label>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        ["PARTNER_ENTRY", "V3 Partner Entry", "30% · Entrada"],
                        ["PARTNER",       "V3 Partner",       "30% · Completo"],
                        ["PARTNER_PRO",   "V3 Partner PRO",   "50% · Máximo"],
                      ].map(([val, label, sub]) => (
                        <button key={val} type="button" onClick={() => setFormData(f => ({ ...f, plano: val }))}
                          className="py-4 px-3 text-left transition-all"
                          style={{ background: formData.plano === val ? `${G}18` : N3, border: `1px solid ${formData.plano === val ? G + "70" : N4}`, borderRadius: 6 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: formData.plano === val ? G : CR, marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 10, color: MT }}>{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </Reveal>

                {formError && (
                  <p style={{ fontSize: 12, color: "#EF4444", padding: "10px 14px", borderRadius: 5, background: "#EF444412", border: "1px solid #EF444428" }}>{formError}</p>
                )}

                <Reveal direction="up" delay={240}>
                  <button type="submit" disabled={sending} className="w-full font-bold transition-all hover:opacity-88"
                    style={{ background: G, color: N, borderRadius: 5, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", padding: "18px 0", opacity: sending ? 0.7 : 1 }}>
                    {sending ? "VERIFICANDO..." : "VERIFICAR DISPONIBILIDADE DA MINHA PRAÇA"}
                  </button>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 28px", marginTop: 16 }}>
                    {([
                      [Shield, "Sem spam, jamais"],
                      [Zap, "Retorno em até 24h"],
                      [ArrowUpRight, "Sem compromisso inicial"],
                    ] as [typeof Shield, string][]).map(([Icon, text]) => (
                      <div key={text} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon size={12} color={G} />
                        <span style={{ fontSize: 11, color: MT }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background: N, borderTop: `1px solid ${N4}` }}>
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} style={{ borderRadius: 8 }} />
            <div>
              <p style={{ fontWeight: 900, fontSize: 12, color: G, letterSpacing: 3.5 }}>V3 PARTNERS</p>
              <p style={{ fontSize: 10, color: MT, marginTop: 1 }}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="/seja-fornecedor" style={{ fontSize: 12, color: MT, fontWeight: 500 }} className="hover:text-white transition-colors">Marketplace Fornecedores</a>
            <a href="/fornecedor/login" style={{ fontSize: 12, color: MT, fontWeight: 500 }} className="hover:text-white transition-colors">Portal Fornecedor</a>
          </div>
          <p style={{ fontSize: 11, color: `${MT}80` }}>© 2026 V3 Partners · Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronRight, X, Menu, Check, Plus, ArrowRight, Shield, Zap, TrendingUp, Eye, Star, Users } from "lucide-react";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";

// ── Paleta V3 ──────────────────────────────────────────────────────────────
const G  = "#C9A84C";
const G2 = "#E8C97A";
const N  = "#09081A";
const N2 = "#111F35";
const N3 = "#162744";
const N4 = "#243A66";
const CR = "#F0ECE4";
const MT = "#7A8FA8";

// ── BRAZIL STATES ──────────────────────────────────────────────────────────
const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

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
  const t: Record<string, string> = { up: "translateY(36px)", left: "translateX(-36px)", right: "translateX(36px)", none: "none" };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : t[direction],
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(.22,.68,0,1.2) ${delay}ms`,
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
function CTABtn({ onClick, children, outline = false, large = false }: {
  onClick: () => void; children: React.ReactNode; outline?: boolean; large?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="inline-flex items-center justify-center gap-2 font-bold transition-all"
      style={{
        background: outline ? "transparent" : hov ? G2 : G,
        color: outline ? (hov ? G2 : G) : N,
        border: `2px solid ${hov ? G2 : G}`,
        padding: large ? "17px 48px" : "13px 32px",
        borderRadius: 3, fontSize: large ? 13 : 12,
        letterSpacing: 2.2, textTransform: "uppercase" as const,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov && !outline ? `0 14px 36px ${G}45` : "none",
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
function ParallaxOrb({ top, left, size, delay }: { top: string; left: string; size: number; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = () => { if (ref.current) ref.current.style.transform = `translateY(${window.scrollY * 0.09 + delay}px)`; };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [delay]);
  return <div ref={ref} style={{ position: "absolute", top, left, width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle, ${G}0C 0%, transparent 70%)`, pointerEvents: "none" }} />;
}

// ── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, source, delay = 0 }: {
  icon: React.ReactNode; value: string; label: string; source: string; delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="rounded-xl p-6 h-full" style={{ background: N3, border: `1px solid ${N4}` }}>
        <div className="mb-4" style={{ color: G }}>{icon}</div>
        <p style={{ fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 900, color: G, lineHeight: 1, marginBottom: 8 }}>{value}</p>
        <p style={{ fontSize: 14, color: CR, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{label}</p>
        <p style={{ fontSize: 10, color: MT, fontStyle: "italic" }}>{source}</p>
      </div>
    </Reveal>
  );
}

// ── BenefitRow ─────────────────────────────────────────────────────────────
function BenefitRow({ icon, title, desc, delay = 0 }: { icon: string; title: string; desc: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="flex items-start gap-5 py-6" style={{ borderBottom: `1px solid ${N4}` }}>
        <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl"
          style={{ background: `${G}12`, border: `1px solid ${G}22` }}>{icon}</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: CR, marginBottom: 5 }}>{title}</p>
          <p style={{ fontSize: 13, color: MT, lineHeight: 1.8 }}>{desc}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ── StepCard ───────────────────────────────────────────────────────────────
function StepCard({ n, title, body, delay = 0 }: { n: string; title: string; body: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="relative p-7 rounded-xl h-full" style={{ background: N2, border: `1px solid ${N4}` }}>
        <div style={{ fontSize: "clamp(52px, 6vw, 68px)", fontWeight: 900, color: `${G}18`, lineHeight: 1, marginBottom: 16, letterSpacing: -2 }}>{n}</div>
        <p style={{ fontWeight: 800, fontSize: 15, color: G, marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 13, color: MT, lineHeight: 1.8 }}>{body}</p>
      </div>
    </Reveal>
  );
}

// ── CategoryBadge ──────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  "Equipamentos de Saúde":  "🏥",
  "Mentoria & Consultoria": "🎯",
  "Tecnologia & SaaS":      "💻",
  "Serviços Financeiros":   "📊",
  "Treinamentos & Cursos":  "🎓",
  "Imóveis & Real Estate":  "🏗️",
  "Agronegócio":            "🌾",
  "Outros":                 "📦",
};

// ── FORM FIELD ─────────────────────────────────────────────────────────────
function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: N2, border: `1px solid ${N4}`, borderRadius: 4, color: CR,
  width: "100%", padding: "14px 18px", fontSize: 14, outline: "none",
};

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export function SupplierLandingClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  // Form state
  const [form, setForm] = useState({
    company_name: "", cnpj: "", contact_name: "", email: "",
    phone: "", city: "", state: "", website: "", description: "",
    categories: [] as string[], password: "", confirm_password: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");
  const [step, setStep] = useState(1); // 1 = dados empresa, 2 = categorias + senha

  useEffect(() => {
    const h = () => { setScrolled(window.scrollY > 40); setShowSticky(window.scrollY > 600); };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const go = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }, []);

  function toggleCategory(cat: string) {
    setForm(f => {
      const has = f.categories.includes(cat);
      if (has) return { ...f, categories: f.categories.filter(c => c !== cat) };
      if (f.categories.length >= 5) return f;
      return { ...f, categories: [...f.categories, cat] };
    });
  }

  function formatCNPJ(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 14);
    return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
            .replace(/(\d{2})(\d{3})(\d{3})(\d{4})$/, "$1.$2.$3/$4")
            .replace(/(\d{2})(\d{3})(\d{3})$/, "$1.$2.$3")
            .replace(/(\d{2})(\d{3})$/, "$1.$2")
            .replace(/(\d{2})$/, "$1");
  }

  function formatPhone(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  function validateStep1() {
    if (!form.company_name || !form.cnpj || !form.contact_name || !form.email || !form.phone || !form.city || !form.state || !form.description) {
      setFormError("Preencha todos os campos obrigatórios."); return false;
    }
    if (form.description.length < 20) { setFormError("Descrição deve ter ao menos 20 caracteres."); return false; }
    setFormError(""); return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.categories.length === 0) { setFormError("Selecione ao menos uma categoria."); return; }
    if (form.password.length < 8) { setFormError("Senha deve ter ao menos 8 caracteres."); return; }
    if (form.password !== form.confirm_password) { setFormError("As senhas não coincidem."); return; }
    setSending(true); setFormError("");
    try {
      const payload = {
        company_name: form.company_name,
        cnpj: form.cnpj,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        state: form.state,
        website: form.website || null,
        description: form.description,
        categories: form.categories,
        password: form.password,
      };
      const res = await fetch("/api/marketplace/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) setSent(true);
      else setFormError(data.error ?? "Erro ao cadastrar. Tente novamente.");
    } catch { setFormError("Erro de conexão. Tente novamente."); }
    finally { setSending(false); }
  }

  return (
    <div style={{ background: N, color: CR, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap" rel="stylesheet" />

      {/* ── STICKY BAR ──────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(9,8,26,0.97)", backdropFilter: "blur(20px)",
        borderTop: `1px solid ${N4}`,
        transform: showSticky ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.4s cubic-bezier(.4,0,.2,1)",
      }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <p style={{ fontSize: 13, fontWeight: 600, color: CR }} className="hidden sm:block">
            Marketplace V3 Partners —{" "}
            <span style={{ color: G }}>distribua para Partners qualificados em todo o Brasil.</span>
          </p>
          <button onClick={() => go("cadastro")}
            className="flex items-center gap-2 font-bold ml-auto transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "10px 28px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Cadastrar minha empresa <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        background: scrolled ? "rgba(9,8,26,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${N4}` : "none",
        transition: "all 0.3s ease",
      }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between" style={{ height: 72 }}>
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={34} height={34} className="rounded-lg" />
            <div>
              <span style={{ fontWeight: 900, fontSize: 12, color: G, letterSpacing: 3 }}>V3 PARTNERS</span>
              <span style={{ fontSize: 10, color: MT, letterSpacing: 1.5, display: "block", lineHeight: 1 }}>MARKETPLACE</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["Por que V3", "porque"], ["Como funciona", "como"], ["Categorias", "categorias"], ["FAQ", "faq"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} style={{ fontSize: 12, fontWeight: 500, color: MT }} className="hover:text-white transition-colors">{l}</button>
            ))}
          </div>
          <button onClick={() => go("cadastro")} className="hidden md:block font-bold hover:opacity-85 transition-all"
            style={{ background: G, color: N, padding: "9px 22px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Cadastrar empresa
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CR }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-1" style={{ background: "rgba(9,8,26,0.99)", borderTop: `1px solid ${N4}` }}>
            {[["Por que V3", "porque"], ["Como funciona", "como"], ["Categorias", "categorias"], ["FAQ", "faq"], ["Cadastrar empresa", "cadastro"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="block w-full text-left py-3 text-sm" style={{ color: CR, borderBottom: `1px solid ${N4}` }}>{l}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          01 · HERO
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: N, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${N4}15 1px, transparent 1px), linear-gradient(to right, ${N4}15 1px, transparent 1px)`, backgroundSize: "72px 72px", opacity: 0.4 }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <ParallaxOrb top="5%"  left="62%" size={700} delay={0} />
        <ParallaxOrb top="58%" left="-6%" size={480} delay={14} />
        <ParallaxOrb top="70%" left="80%" size={320} delay={8} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, ${N} 100%)`, pointerEvents: "none" }} />

        <div className="max-w-5xl mx-auto px-6 relative w-full" style={{ paddingTop: 160, paddingBottom: 120 }}>
          <Reveal direction="none">
            <div className="inline-flex items-center gap-2 mb-8" style={{ background: `${G}12`, border: `1px solid ${G}30`, borderRadius: 40, padding: "6px 20px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: G, boxShadow: `0 0 8px ${G}` }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>MARKETPLACE V3 PARTNERS · FORNECEDORES</span>
            </div>
          </Reveal>

          <Reveal direction="up" delay={80}>
            <h1 style={{ fontSize: "clamp(34px, 6vw, 74px)", fontWeight: 900, lineHeight: 1.02, color: CR, letterSpacing: -1.5, marginBottom: 0, maxWidth: 900 }}>
              Seus produtos nas mãos de
            </h1>
          </Reveal>
          <Reveal direction="up" delay={150}>
            <h1 style={{ fontSize: "clamp(34px, 6vw, 74px)", fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.5, marginBottom: 0 }}>
              <span style={{ background: `linear-gradient(125deg, ${G} 0%, ${G2} 55%, ${G} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Partners financeiros
              </span>
            </h1>
          </Reveal>
          <Reveal direction="up" delay={220}>
            <h1 style={{ fontSize: "clamp(34px, 6vw, 74px)", fontWeight: 900, lineHeight: 1.02, color: CR, letterSpacing: -1.5, marginBottom: 32 }}>
              em todo o Brasil.
            </h1>
          </Reveal>

          <Reveal direction="up" delay={300}>
            <p style={{ fontSize: "clamp(16px, 1.8vw, 20px)", color: MT, lineHeight: 1.8, maxWidth: 700, marginBottom: 14 }}>
              O Marketplace V3 Partners conecta fornecedores a uma rede ativa de consultores, advisors e parceiros financeiros qualificados — profissionais que atendem diretamente empresários, CFOs e executivos tomadores de decisão.
            </p>
            <p style={{ fontSize: "clamp(15px, 1.5vw, 17px)", color: `${CR}80`, lineHeight: 1.75, maxWidth: 660, marginBottom: 52, fontStyle: "italic" }}>
              Você cadastra. Nós distribuímos. Os Partners vendem. Você define a comissão. Simples assim.
            </p>
          </Reveal>

          <Reveal direction="up" delay={380}>
            <div className="flex flex-wrap gap-4">
              <CTABtn onClick={() => go("cadastro")} large>Cadastrar minha empresa</CTABtn>
              <CTABtn onClick={() => go("como")} outline large>Ver como funciona</CTABtn>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20">
            {[
              { n: 8,   suf: "",   label: "categorias de produtos" },
              { n: 27,  suf: "",   label: "estados cobertos" },
              { n: 48,  suf: "h",  label: "para aprovação do cadastro" },
              { n: 100, suf: "%",  label: "você define a comissão" },
            ].map(({ n, suf, label }, i) => (
              <Reveal key={label} delay={440 + i * 65}>
                <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(17,31,53,0.8)", border: `1px solid ${N4}`, backdropFilter: "blur(16px)" }}>
                  <p style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                    <Counter to={n} suffix={suf} />
                  </p>
                  <p style={{ fontSize: 11, color: MT, marginTop: 6, lineHeight: 1.4 }}>{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CREDIBILITY BAR ─────────────────────────────────────────────── */}
      <div style={{ background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}`, padding: "20px 0" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {[
              { icon: "🤝", text: "Rede ativa de Partners qualificados" },
              { icon: "🏛️", text: "Boutique institucional V3" },
              { icon: "🤖", text: "IA para matching de produtos" },
              { icon: "📊", text: "CRM integrado por produto" },
              { icon: "📜", text: "CNPJ 14.219.287/0001-50" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 11, color: MT, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          02 · MERCADO — Dados que convencem
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 55% 55% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>O mercado já decidiu — está em marketplaces B2B</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 44px)", fontWeight: 800, color: CR, lineHeight: 1.2, marginBottom: 14, maxWidth: 800 }}>
              Empresas que vendem via canal de parceiros crescem{" "}
              <span style={{ color: G }}>3x mais rápido</span> do que as que dependem só de vendas diretas.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.85, maxWidth: 720, marginBottom: 56 }}>
              O mercado B2B brasileiro migrou. Fornecedores que ainda dependem de equipe de vendas própria competem em desvantagem contra empresas que ativaram redes de distribuição indireta — com alcance nacional, custo variável e comissionamento baseado em resultado.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
            <StatCard delay={0}   icon={<TrendingUp size={22} />} value="87%"   label="Marketplaces B2B cresceram no Brasil entre 2021 e 2024"    source="Ebit | Nielsen, 2024" />
            <StatCard delay={80}  icon={<Users size={22} />}      value="3×"    label="Mais leads qualificados via canal de parceiros vs venda direta" source="Forrester Research" />
            <StatCard delay={160} icon={<Star size={22} />}        value="2,4×"  label="Maior ticket médio em vendas B2B via parceiros especializados"  source="McKinsey & Company" />
            <StatCard delay={240} icon={<Eye size={22} />}         value="78%"   label="Das empresas B2B planejam ampliar canais indiretos até 2026"    source="Gartner, 2024" />
          </div>
          <Reveal delay={300}>
            <div className="rounded-2xl p-8" style={{ background: N2, border: `1px solid ${G}30` }}>
              <p style={{ fontSize: "clamp(17px, 2.2vw, 22px)", fontWeight: 700, color: CR, lineHeight: 1.55, margin: 0 }}>
                O Marketplace V3 não é mais um canal de vendas genérico.{" "}
                <span style={{ color: G }}>É uma rede de profissionais financeiros que atendem exatamente quem compra o que você vende.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          03 · POR QUE V3 — Diferenciais
      ═══════════════════════════════════════════════════════════════ */}
      <section id="porque" style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Por que o Marketplace V3</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 40px)", fontWeight: 800, color: CR, lineHeight: 1.25, marginBottom: 14, maxWidth: 820 }}>
              Não é uma vitrine. É uma máquina de distribuição com público qualificado.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.85, maxWidth: 720, marginBottom: 52 }}>
              Os Partners V3 atendem empresários, CFOs, executivos e investidores — perfis que têm capacidade de compra, urgência real e abertura para produtos e serviços que gerem valor. São consultores treinados que recomendam, não apenas exibem.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-x-16">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <BenefitRow delay={0}   icon="🎯" title="Público 100% qualificado" desc="Os Partners V3 atendem empresários, CFOs, gestores e executivos com poder de decisão de compra. Não é tráfego aleatório — é relacionamento direto com o tomador de decisão." />
              <BenefitRow delay={80}  icon="🤖" title="IA que combina produto com o Partner certo" desc="Nosso sistema de matching analisa perfil dos Partners e direciona automaticamente seu produto para os 5 mais qualificados da rede. Você não precisa fazer nada — a tecnologia trabalha por você." />
              <BenefitRow delay={160} icon="📊" title="CRM integrado por produto" desc="Cada lead gerado para o seu produto é registrado, rastreado e categorizado. Você acompanha o funil em tempo real direto no painel do fornecedor." />
              <BenefitRow delay={240} icon="💰" title="Comissão definida por você" desc="Você decide quanto paga por resultado. Nenhum custo fixo de distribuição — só paga quando vende. O modelo de comissão é totalmente flexível e configurável por produto." />
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <BenefitRow delay={0}   icon="🌐" title="Alcance nacional desde o primeiro dia" desc="A rede V3 opera em todos os estados brasileiros. Quando seu produto é aprovado, a distribuição é imediata — sem montar equipe, sem abrir filiais, sem custo de expansão." />
              <BenefitRow delay={80}  icon="🏛️" title="Credencial institucional" desc="Estar no Marketplace V3 é um selo de qualidade. Os Partners apresentam seus produtos com o respaldo de uma boutique institucional — aumentando a credibilidade e acelerando o fechamento." />
              <BenefitRow delay={160} icon="📋" title="Due diligence e aprovação estruturada" desc="Antes de publicar, seu cadastro passa por análise da equipe V3. Isso garante que apenas fornecedores sérios entram na plataforma — protegendo a qualidade do ecossistema." />
              <BenefitRow delay={240} icon="📱" title="Proposta gerada por IA para o cliente final" desc="O Partner pode gerar uma proposta comercial personalizada com IA para o seu produto — em formato WhatsApp e e-mail — com um clique. Reduz o ciclo de venda." />
            </div>
          </div>
          <Reveal delay={280}>
            <div className="mt-14">
              <CTABtn onClick={() => go("cadastro")}>Quero distribuir meus produtos aqui</CTABtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          04 · COMO FUNCIONA
      ═══════════════════════════════════════════════════════════════ */}
      <section id="como" style={{ background: N, padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 55% 55% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>Como funciona</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 56, maxWidth: 680 }}>
              Cadastro simples. Aprovação rápida. Distribuição imediata.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5 mb-14">
            <StepCard delay={0}   n="01" title="Cadastre-se" body="Preencha o formulário com dados da empresa, descrição dos produtos e defina as categorias. Aprovação em até 48h." />
            <StepCard delay={90}  n="02" title="Publique produtos" body="Acesse o painel do fornecedor, adicione seus produtos com descrição, preço, imagens e defina a comissão para os Partners." />
            <StepCard delay={180} n="03" title="A IA faz o matching" body="Nosso sistema combina seu produto com os Partners mais qualificados da rede e notifica automaticamente os top 5." />
            <StepCard delay={270} n="04" title="Receba os leads" body="Os Partners levam seu produto para os clientes. Você acompanha os leads em tempo real no painel e fecha diretamente." />
          </div>

          {/* Divisão de responsabilidades */}
          <Reveal delay={300}>
            <div className="rounded-2xl overflow-hidden mb-12" style={{ border: `1px solid ${N4}` }}>
              <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${N4}` }}>
                <div className="px-8 py-5" style={{ background: N3, borderRight: `1px solid ${N4}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: MT }}>VOCÊ FAZ</p>
                </div>
                <div className="px-8 py-5" style={{ background: `${G}0C` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: G }}>A V3 FAZ</p>
                </div>
              </div>
              {[
                ["Cadastra empresa e produtos", "Analisa e aprova o cadastro em até 48h"],
                ["Define comissão por produto", "Distribui automaticamente para a rede de Partners"],
                ["Acompanha leads no painel", "IA faz matching com os Partners mais qualificados"],
                ["Negocia e fecha com o cliente", "Gera propostas personalizadas para o Partner"],
                ["Paga comissão por venda realizada", "Treina os Partners para apresentar seus produtos"],
              ].map(([voce, v3], i) => (
                <div key={i} className="grid grid-cols-2" style={{ borderBottom: i < 4 ? `1px solid ${N4}` : "none" }}>
                  <div className="px-8 py-4" style={{ background: N3, borderRight: `1px solid ${N4}` }}>
                    <p style={{ fontSize: 13, color: MT }}>{voce}</p>
                  </div>
                  <div className="px-8 py-4" style={{ background: `${G}06` }}>
                    <p style={{ fontSize: 13, color: CR, fontWeight: 500 }}>{v3}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={340}>
            <CTABtn onClick={() => go("cadastro")}>Começar agora</CTABtn>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          05 · CATEGORIAS
      ═══════════════════════════════════════════════════════════════ */}
      <section id="categorias" style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Categorias disponíveis no marketplace</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 14, maxWidth: 700 }}>
              Qual é o segmento do seu produto?
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.8, maxWidth: 640, marginBottom: 52 }}>
              Aceitamos fornecedores de 8 categorias estratégicas. Todas com demanda ativa da rede de Partners. Se seu produto não se encaixa em nenhuma, use "Outros" — avaliamos individualmente.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-14">
            {MARKETPLACE_CATEGORIES.map((cat, i) => (
              <Reveal key={cat} delay={i * 55}>
                <div className="rounded-xl p-6" style={{ background: N3, border: `1px solid ${N4}` }}>
                  <div className="text-2xl mb-3">{CATEGORY_ICONS[cat]}</div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: CR, lineHeight: 1.35 }}>{cat}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={300}>
            <div className="rounded-xl p-6 flex items-start gap-4 mb-10" style={{ background: N3, border: `1px solid ${N4}` }}>
              <div style={{ fontSize: 20, flexShrink: 0 }}>💡</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: CR, marginBottom: 4 }}>Não está na lista?</p>
                <p style={{ fontSize: 13, color: MT, lineHeight: 1.7 }}>
                  Cadastre-se mesmo assim e use a categoria "Outros". Nossa equipe avalia se seu produto é adequado para a rede V3. Se houver potencial, aprovamos e criamos uma categoria específica para você.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={340}>
            <CTABtn onClick={() => go("cadastro")}>Cadastrar minha empresa</CTABtn>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          06 · QUEM PODE SER FORNECEDOR
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Quem pode ser fornecedor V3</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 14, maxWidth: 700 }}>
              Se você vende para empresas, você pertence aqui.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.8, maxWidth: 660, marginBottom: 52 }}>
              O Marketplace V3 foi construído para fornecedores B2B que querem acelerar suas vendas com um canal de distribuição qualificado e escalável.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-14">
            {[
              ["💊", "Fornecedores de equipamentos médicos e hospitalares", "que vendem para clínicas, hospitais e operadoras"],
              ["🖥️", "Empresas de tecnologia e SaaS",                       "com produtos para gestão empresarial, ERP, CRM, automação"],
              ["🎓", "Escolas de negócios e plataformas de educação",        "com cursos executivos, MBAs, treinamentos corporativos"],
              ["🏗️", "Construtoras e incorporadoras",                        "com produtos de real estate para investidores e empresas"],
              ["🌾", "Empresas do agronegócio",                              "com insumos, equipamentos e soluções para produtores rurais"],
              ["📊", "Consultorias e escritórios especializados",             "que oferecem serviços financeiros, contábeis, jurídicos"],
              ["⚡", "Startups e scale-ups B2B",                             "que precisam de canal de vendas sem montar equipe própria"],
              ["🔧", "Indústrias e fabricantes",                             "que buscam representantes qualificados para distribuição nacional"],
              ["🤝", "Empresas de benefícios corporativos",                  "com planos, serviços e soluções para o ambiente empresarial"],
            ].map(([icon, title, desc], i) => (
              <Reveal key={title} delay={i * 50}>
                <div className="rounded-xl p-5 h-full" style={{ background: N2, border: `1px solid ${N4}` }}>
                  <div className="text-xl mb-3">{icon}</div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: CR, marginBottom: 5, lineHeight: 1.35 }}>{title}</p>
                  <p style={{ fontSize: 12, color: MT, lineHeight: 1.6 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={320}>
            <div className="rounded-2xl px-8 py-7" style={{ background: `${G}0C`, border: `1px solid ${G}25` }}>
              <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: CR, fontWeight: 700, lineHeight: 1.6, margin: 0 }}>
                Requisito único:{" "}
                <span style={{ color: G }}>seu produto ou serviço deve gerar valor real para empresas e seus gestores.</span>{" "}
                Nossa equipe avalia o fit com a rede antes da aprovação.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          07 · QUOTE — Aspiracional
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "100px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 55% at 50% 50%, ${G}07 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <Reveal>
            <div style={{ fontSize: 60, color: `${G}35`, lineHeight: 1, marginBottom: 28, fontFamily: "Georgia, serif" }}>"</div>
            <p style={{ fontSize: "clamp(20px, 3vw, 34px)", fontWeight: 800, color: CR, lineHeight: 1.4, marginBottom: 24 }}>
              Você não precisa de mais uma equipe de vendas. Você precisa da rede certa vendendo por você.
            </p>
            <div style={{ width: 48, height: 2, background: G, margin: "0 auto 24px" }} />
            <p style={{ fontSize: 13, color: MT, fontWeight: 600, letterSpacing: 1.5 }}>V3 PARTNERS · MARKETPLACE INSTITUCIONAL</p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-14">
              <CTABtn onClick={() => go("cadastro")} large>Quero entrar no marketplace</CTABtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          08 · FAQ
      ═══════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: N, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Perguntas frequentes</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Reveal>
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 36px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 20 }}>
                  Tire suas dúvidas antes de cadastrar.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.85, marginBottom: 36 }}>
                  Nosso processo é simples e transparente. Se sua dúvida não estiver aqui, nossa equipe responde após o cadastro.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <CTABtn onClick={() => go("cadastro")}>Ir para o cadastro</CTABtn>
              </Reveal>
            </div>
            <Reveal direction="right">
              <div style={{ borderTop: `1px solid ${N4}` }}>
                {[
                  { q: "Quanto custa ser fornecedor no Marketplace V3?", a: "O cadastro como fornecedor é gratuito. Você só paga quando vende — na forma de comissão para o Partner que realizou a venda. O percentual de comissão é definido por você no cadastro de cada produto." },
                  { q: "Quanto tempo leva para meu cadastro ser aprovado?", a: "Nossa equipe analisa e aprova cadastros em até 48 horas úteis. Você receberá um e-mail com o resultado e, se aprovado, acesso ao painel para publicar seus produtos." },
                  { q: "Posso definir qualquer percentual de comissão?", a: "Sim. Você define a comissão por produto individualmente. Recomendamos comissões entre 5% e 30% para maximizar o interesse dos Partners, mas a decisão é sua. A V3 também pode definir uma comissão adicional para o Partner durante a aprovação." },
                  { q: "Quantos produtos posso cadastrar?", a: "Não há limite de produtos. Você pode cadastrar todo o seu portfólio. Cada produto passa por aprovação individual da equipe V3 antes de ser publicado na vitrine dos Partners." },
                  { q: "Como funciona o acesso dos Partners aos meus produtos?", a: "Quando seu produto é aprovado, ele aparece automaticamente no catálogo da plataforma. Nossa IA faz o matching com os top 5 Partners mais qualificados para aquele produto e envia notificações a eles." },
                  { q: "Posso acompanhar quantos leads e vendas cada produto gerou?", a: "Sim. No painel do fornecedor você tem acesso ao histórico completo de leads por produto, status de cada oportunidade e dados de conversão. Tudo em tempo real." },
                  { q: "O que acontece se um lead for gerado mas não converter?", a: "Você não paga nada. O modelo é baseado em resultado — comissão só é devida quando há venda efetivada. Leads que não convertem não geram custo." },
                  { q: "Posso ter exclusividade por região?", a: "Atualmente a distribuição é nacional para todos os fornecedores. Condições especiais de exclusividade por segmento ou região podem ser negociadas diretamente com a equipe V3 após aprovação." },
                ].map(({ q, a }, i) => <FAQItem key={q} n={i + 1} q={q} a={a} />)}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          09 · CTA FINAL
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <ParallaxOrb top="0%"  left="5%"  size={600} delay={0} />
        <ParallaxOrb top="20%" left="80%" size={400} delay={10} />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 mb-8" style={{ background: `${G}12`, border: `1px solid ${G}30`, borderRadius: 40, padding: "7px 20px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: G, boxShadow: `0 0 8px ${G}` }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>CADASTRO ABERTO · APROVAÇÃO EM ATÉ 48H</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 900, color: CR, lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>
              Seus produtos merecem
              <br />
              <span style={{ color: G }}>uma rede que os vende de verdade.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: MT, lineHeight: 1.85, marginBottom: 44 }}>
              Cadastre sua empresa hoje. Em até 48 horas você tem acesso ao painel, publica seus produtos e começa a receber leads de Partners qualificados que atendem empresários e executivos em todo o Brasil.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <CTABtn onClick={() => go("cadastro")} large>Cadastrar minha empresa agora</CTABtn>
          </Reveal>
          <Reveal delay={300}>
            <p style={{ fontSize: 12, color: `${MT}80`, marginTop: 20 }}>Gratuito. Comissão só quando vender.</p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          10 · FORMULÁRIO DE CADASTRO
      ═══════════════════════════════════════════════════════════════ */}
      <section id="cadastro" style={{ background: N, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 0%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-2xl mx-auto px-6 relative">
          <SectionLabel>Cadastro de fornecedor</SectionLabel>

          {sent ? (
            <Reveal>
              <div className="rounded-2xl p-14 text-center" style={{ background: N2, border: `1px solid ${G}40` }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${G}15`, border: `1px solid ${G}35` }}>
                  <Check size={32} color={G} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 26, color: CR, marginBottom: 14 }}>Cadastro enviado!</h3>
                <p style={{ color: MT, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
                  Obrigado, <strong style={{ color: CR }}>{form.company_name}</strong>!{" "}
                  Sua solicitação está em análise. Você receberá um e-mail em{" "}
                  <strong style={{ color: G }}>{form.email}</strong> em até 48 horas com o resultado da aprovação.
                </p>
                <div className="rounded-xl px-6 py-5 text-left" style={{ background: N3, border: `1px solid ${N4}` }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: CR, marginBottom: 8 }}>Próximos passos:</p>
                  {[
                    "Você receberá um e-mail de confirmação em breve",
                    "Nossa equipe analisa o cadastro em até 48h úteis",
                    "Se aprovado, você acessa o painel para publicar produtos",
                    "Os Partners começam a receber notificações sobre seus produtos",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${G}20`, border: `1px solid ${G}40` }}>
                        <Check size={10} color={G} />
                      </div>
                      <p style={{ fontSize: 13, color: MT }}>{step}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <a href="/fornecedor/login" style={{ fontSize: 13, color: G, fontWeight: 600 }}>
                    Já aprovado? Acessar o painel do fornecedor →
                  </a>
                </div>
              </div>
            </Reveal>
          ) : (
            <>
              <Reveal>
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 36px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 14 }}>
                  {step === 1 ? "Dados da empresa" : "Categorias e acesso"}
                </h2>
              </Reveal>
              <Reveal delay={60}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.8, marginBottom: 32 }}>
                  {step === 1
                    ? "Preencha os dados da sua empresa. Após aprovação você acessa o painel para publicar seus produtos."
                    : "Selecione as categorias do seu portfólio e crie uma senha para acessar o painel do fornecedor."}
                </p>
              </Reveal>

              {/* Step indicator */}
              <Reveal delay={80}>
                <div className="flex items-center gap-3 mb-10">
                  {[1, 2].map(s => (
                    <div key={s} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{
                        background: s <= step ? G : N3,
                        color: s <= step ? N : MT,
                        border: `1px solid ${s <= step ? G : N4}`,
                      }}>{s}</div>
                      {s === 1 && <div style={{ width: 40, height: 2, background: step > 1 ? G : N4, transition: "background 0.4s ease" }} />}
                    </div>
                  ))}
                  <p style={{ fontSize: 12, color: MT, marginLeft: 4 }}>{step === 1 ? "Dados da empresa" : "Categorias e senha"}</p>
                </div>
              </Reveal>

              <form onSubmit={step === 1 ? (e) => { e.preventDefault(); if (validateStep1()) setStep(2); } : handleSubmit}>
                {step === 1 && (
                  <Reveal direction="up">
                    <div className="space-y-4">
                      <Field label="RAZÃO SOCIAL / NOME DA EMPRESA" required>
                        <input type="text" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                          placeholder="Nome da sua empresa" required className="w-full focus:outline-none" style={inputStyle} />
                      </Field>
                      <Field label="CNPJ" required>
                        <input type="text" value={form.cnpj}
                          onChange={e => setForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))}
                          placeholder="00.000.000/0000-00" required className="w-full focus:outline-none" style={inputStyle} />
                      </Field>
                      <Field label="NOME DO RESPONSÁVEL" required>
                        <input type="text" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                          placeholder="Nome completo do responsável" required className="w-full focus:outline-none" style={inputStyle} />
                      </Field>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="E-MAIL COMERCIAL" required>
                          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="contato@empresa.com.br" required className="w-full focus:outline-none" style={inputStyle} />
                        </Field>
                        <Field label="TELEFONE / WHATSAPP" required>
                          <input type="tel" value={form.phone}
                            onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                            placeholder="(11) 99999-9999" required className="w-full focus:outline-none" style={inputStyle} />
                        </Field>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <Field label="CIDADE" required>
                            <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                              placeholder="Sua cidade" required className="w-full focus:outline-none" style={inputStyle} />
                          </Field>
                        </div>
                        <Field label="ESTADO" required>
                          <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                            required className="w-full focus:outline-none" style={{ ...inputStyle, cursor: "pointer" }}>
                            <option value="">UF</option>
                            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </Field>
                      </div>
                      <Field label="SITE DA EMPRESA">
                        <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                          placeholder="https://suaempresa.com.br" className="w-full focus:outline-none" style={inputStyle} />
                      </Field>
                      <Field label="DESCRIÇÃO DOS PRODUTOS E SERVIÇOS" required>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Descreva o que sua empresa oferece, para qual público e qual problema resolve. Mínimo 20 caracteres."
                          rows={4} required className="w-full focus:outline-none resize-none"
                          style={{ ...inputStyle, lineHeight: 1.65 }} />
                        <p style={{ fontSize: 10, color: MT, marginTop: 4 }}>{form.description.length}/2000 caracteres</p>
                      </Field>
                      {formError && <p style={{ fontSize: 12, color: "#EF4444", padding: "10px 14px", borderRadius: 4, background: "#EF444412", border: "1px solid #EF444428" }}>{formError}</p>}
                      <button type="submit" className="w-full py-5 font-bold transition-all hover:opacity-88 mt-2"
                        style={{ background: G, color: N, borderRadius: 4, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase" }}>
                        CONTINUAR <ChevronRight size={14} style={{ display: "inline", verticalAlign: "middle" }} />
                      </button>
                    </div>
                  </Reveal>
                )}

                {step === 2 && (
                  <Reveal direction="up">
                    <div className="space-y-6">
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 12 }}>
                          CATEGORIAS DOS SEUS PRODUTOS * <span style={{ color: MT, fontWeight: 400 }}>(selecione até 5)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {MARKETPLACE_CATEGORIES.map(cat => {
                            const sel = form.categories.includes(cat);
                            return (
                              <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                                className="flex items-center gap-3 px-4 py-3 text-left transition-all rounded-lg"
                                style={{ background: sel ? `${G}18` : N2, border: `1px solid ${sel ? G + "70" : N4}` }}>
                                <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[cat]}</span>
                                <p style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? G : MT, lineHeight: 1.3 }}>{cat}</p>
                                {sel && <Check size={14} color={G} className="ml-auto flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: 11, color: MT, marginTop: 8 }}>
                          {form.categories.length}/5 categorias selecionadas
                        </p>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="SENHA DE ACESSO" required>
                          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Mínimo 8 caracteres" required className="w-full focus:outline-none" style={inputStyle} />
                        </Field>
                        <Field label="CONFIRMAR SENHA" required>
                          <input type="password" value={form.confirm_password} onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                            placeholder="Repita a senha" required className="w-full focus:outline-none" style={inputStyle} />
                        </Field>
                      </div>
                      {formError && <p style={{ fontSize: 12, color: "#EF4444", padding: "10px 14px", borderRadius: 4, background: "#EF444412", border: "1px solid #EF444428" }}>{formError}</p>}
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setStep(1); setFormError(""); }}
                          className="flex-shrink-0 py-5 px-8 font-bold transition-all hover:opacity-88"
                          style={{ background: "transparent", color: MT, border: `1px solid ${N4}`, borderRadius: 4, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
                          Voltar
                        </button>
                        <button type="submit" disabled={sending} className="flex-1 py-5 font-bold transition-all hover:opacity-88"
                          style={{ background: G, color: N, borderRadius: 4, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", opacity: sending ? 0.7 : 1 }}>
                          {sending ? "ENVIANDO..." : "ENVIAR CADASTRO"}
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
                        {([
                          [Shield,     "Dados protegidos"],
                          [Zap,        "Aprovação em até 48h"],
                          [TrendingUp, "Gratuito para fornecedores"],
                        ] as [typeof Shield, string][]).map(([Icon, text]) => (
                          <div key={text} className="flex items-center gap-2">
                            <Icon size={13} color={G} />
                            <span style={{ fontSize: 11, color: MT }}>{text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Reveal>
                )}
              </form>

              <Reveal delay={200}>
                <p style={{ fontSize: 12, color: MT, textAlign: "center", marginTop: 24 }}>
                  Já tem cadastro?{" "}
                  <a href="/fornecedor/login" style={{ color: G, fontWeight: 600 }}>Acesse o painel do fornecedor →</a>
                </p>
              </Reveal>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background: N, borderTop: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={30} height={30} className="rounded-lg" />
            <div>
              <p style={{ fontWeight: 900, fontSize: 12, color: G, letterSpacing: 3.5 }}>V3 PARTNERS</p>
              <p style={{ fontSize: 10, color: MT, marginTop: 1 }}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <a href="/fornecedor/login" style={{ fontSize: 12, color: MT, fontWeight: 500 }} className="hover:text-white transition-colors">Portal do Fornecedor</a>
            <a href="/parceiro" style={{ fontSize: 12, color: MT, fontWeight: 500 }} className="hover:text-white transition-colors">Seja Partner</a>
          </div>
          <p style={{ fontSize: 11, color: `${MT}80` }}>© 2026 V3 Partners · Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

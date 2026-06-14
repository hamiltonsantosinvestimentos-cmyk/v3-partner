"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Car, Building2 } from "lucide-react";

const V3 = {
  navy:  "#09081A",
  navyB: "#13223A",
  navyC: "#162744",
  navyM: "#243A66",
  gold:  "#C9A84C",
  goldL: "#E8C97A",
  cream: "#F5F1E8",
  muted: "#9BAFC5",
};

const TABS = [
  { href: "/logistica/voos",     label: "Voos",     icon: Plane },
  { href: "/logistica/carros",   label: "Carros",   icon: Car },
  { href: "/logistica/locacoes", label: "Locações", icon: Building2 },
];

export function LogisticaTabs() {
  const pathname = usePathname();

  return (
    <div style={{ borderBottom: `1px solid ${V3.navyC}`, background: V3.navyB, padding: "20px 24px 0" }}>
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(201,168,76,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plane size={18} color={V3.gold} />
        </div>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: V3.cream, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Logística V3</h1>
          <p style={{ fontSize: 11, color: V3.muted, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Monitoramento de viagens da equipe — uso interno</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {TABS.map(tab => {
          const active = pathname?.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", fontSize: 12, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                color: active ? V3.gold : V3.muted,
                borderBottom: active ? `2px solid ${V3.gold}` : "2px solid transparent",
                textDecoration: "none",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

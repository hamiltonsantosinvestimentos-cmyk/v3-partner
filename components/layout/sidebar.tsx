"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  PieChart,
  Building2,
  CreditCard,
  Headphones,
  ChevronDown,
  ChevronRight,
  X,
  TrendingUp,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/constants";

const iconMap = {
  LayoutDashboard,
  Users,
  BrainCircuit,
  PieChart,
  Building2,
  CreditCard,
  Headphones,
  Trophy,
  GraduationCap,
};

interface NavSubItem {
  href: string;
  label: string;
  roles: string[];
}

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
  roles: string[];
  children?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
  },
  {
    href: "/usuarios",
    label: "Usuários",
    icon: "Users",
    roles: ["ADMIN"],
  },
  {
    href: "/ia-assistant",
    label: "IA Assistant",
    icon: "BrainCircuit",
    roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
  },
  {
    href: "/split-fiscal",
    label: "Split Fiscal",
    icon: "PieChart",
    roles: ["ADMIN", "PARTNER", "GESTAO"],
  },
  {
    href: "/ma",
    label: "M&A",
    icon: "Building2",
    roles: ["ADMIN", "GESTAO"],
  },
  {
    href: "/mesa-credito",
    label: "Mesa de Crédito",
    icon: "CreditCard",
    roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO", "PARTNER"],
    children: [
      {
        href: "/mesa-credito/nivel-1",
        label: "N1 — Crédito Varejo",
        roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO", "PARTNER"],
      },
      {
        href: "/mesa-credito/nivel-2",
        label: "N2 — Crédito Estruturado",
        roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO"],
      },
      {
        href: "/mesa-credito/nivel-3",
        label: "N3 — High Ticket",
        roles: ["ADMIN", "GESTAO"],
      },
    ],
  },
  {
    href: "/consorcio",
    label: "Consórcio",
    icon: "Trophy",
    roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
    children: [
      {
        href: "/consorcio/simulacao",
        label: "Simulação",
        roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
      },
      {
        href: "/consorcio/cartas-contempladas",
        label: "Cartas Contempladas",
        roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
      },
      {
        href: "/consorcio/projetos",
        label: "Projetos",
        roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
      },
    ],
  },
  {
    href: "/mesa-operacional",
    label: "Mesa Operacional",
    icon: "Headphones",
    roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO"],
  },
  {
    href: "/academy",
    label: "V3 Academy",
    icon: "GraduationCap",
    roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"],
    children: [
      { href: "/academy?cat=home-equity", label: "🏠 Home Equity", roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"] },
      { href: "/academy?cat=estruturado", label: "📊 Crédito Estruturado", roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"] },
      { href: "/academy?cat=high-ticket", label: "⚡ High Ticket", roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"] },
      { href: "/academy?cat=ma", label: "🤝 M&A", roles: ["ADMIN", "GESTAO"] },
      { href: "/academy?cat=split-fiscal", label: "📋 Split Fiscal", roles: ["ADMIN", "PARTNER", "GESTAO"] },
      { href: "/academy?cat=consorcio", label: "🎯 Consórcio", roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"] },
      { href: "/academy?cat=compliance", label: "🛡️ Compliance", roles: ["ADMIN", "PARTNER", "MESA_OPERACIONAL", "GESTAO"] },
    ],
  },
];

interface SidebarProps {
  role: UserRole;
  onClose?: () => void;
}

export function Sidebar({ role, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([
    "/mesa-credito",
  ]);

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <aside className="flex flex-col h-full w-64 bg-[#0F172A] border-r border-border/50">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1B4FD8] to-[#D4A017] flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">
              V3 PARTNER
            </span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Plataforma
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-secondary transition-colors lg:hidden"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {filteredItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const isExpanded = expandedItems.includes(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const filteredChildren = item.children?.filter((child) =>
            child.roles.includes(role)
          );

          return (
            <div key={item.href}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpanded(item.href)}
                  className={cn(
                    "nav-item w-full",
                    isActive ? "nav-item-active" : "nav-item-inactive"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "nav-item",
                    isActive ? "nav-item-active" : "nav-item-inactive"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )}

              {/* Sub-items */}
              {hasChildren && isExpanded && filteredChildren && (
                <div className="ml-7 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
                  {filteredChildren.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                          childActive
                            ? "text-[#3B6EF8] bg-[#1B4FD8]/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                      >
                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Role badge */}
      <div className="px-4 py-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Perfil:</span>
          <span className="text-xs font-semibold text-[#D4A017]">
            {role === "ADMIN"
              ? "Administrador"
              : role === "PARTNER"
              ? "Partner"
              : role === "MESA_OPERACIONAL"
              ? "Mesa Operacional"
              : "Gestão"}
          </span>
        </div>
      </div>
    </aside>
  );
}

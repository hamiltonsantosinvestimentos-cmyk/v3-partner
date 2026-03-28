"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("v3-theme") as "dark" | "light" | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  const applyTheme = (t: "dark" | "light") => {
    const root = document.documentElement;
    if (t === "light") {
      root.style.setProperty("--color-background", "#F8FAFC");
      root.style.setProperty("--color-foreground", "#0F172A");
      root.style.setProperty("--color-card", "#FFFFFF");
      root.style.setProperty("--color-card-foreground", "#0F172A");
      root.style.setProperty("--color-popover", "#FFFFFF");
      root.style.setProperty("--color-popover-foreground", "#0F172A");
      root.style.setProperty("--color-secondary", "#F1F5F9");
      root.style.setProperty("--color-secondary-foreground", "#0F172A");
      root.style.setProperty("--color-muted", "#F1F5F9");
      root.style.setProperty("--color-muted-foreground", "#64748B");
      root.style.setProperty("--color-border", "#E2E8F0");
      root.style.setProperty("--color-input", "#E2E8F0");
      root.setAttribute("data-theme", "light");
      document.body.style.backgroundColor = "#F8FAFC";
      document.body.style.color = "#0F172A";
    } else {
      root.style.setProperty("--color-background", "#060D1A");
      root.style.setProperty("--color-foreground", "#E2E8F0");
      root.style.setProperty("--color-card", "#0F172A");
      root.style.setProperty("--color-card-foreground", "#E2E8F0");
      root.style.setProperty("--color-popover", "#0F172A");
      root.style.setProperty("--color-popover-foreground", "#E2E8F0");
      root.style.setProperty("--color-secondary", "#1E293B");
      root.style.setProperty("--color-secondary-foreground", "#E2E8F0");
      root.style.setProperty("--color-muted", "#0F172A");
      root.style.setProperty("--color-muted-foreground", "#64748B");
      root.style.setProperty("--color-border", "#1E293B");
      root.style.setProperty("--color-input", "#1E293B");
      root.setAttribute("data-theme", "dark");
      document.body.style.backgroundColor = "#060D1A";
      document.body.style.color = "#E2E8F0";
    }
  };

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("v3-theme", next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
      title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
}

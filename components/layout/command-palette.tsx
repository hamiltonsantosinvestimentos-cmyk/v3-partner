"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";

// Movimento V3: Ctrl+K (ou ⌘K) abre a busca rápida de telas. As opções vêm dos links do próprio
// menu lateral no momento em que abre, então cada pessoa só vê as telas que o papel dela libera.

type Item = { href: string; label: string; grupo: string };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function lerMenu(): Item[] {
  const vistos = new Set<string>();
  const itens: Item[] = [];
  document.querySelectorAll<HTMLElement>("[data-cmdk-href]").forEach((el) => {
    const href = el.dataset.cmdkHref!, label = el.dataset.cmdkLabel ?? "";
    if (!label || !href.startsWith("/") || vistos.has(href)) return;
    vistos.add(href);
    itens.push({ href, label, grupo: el.dataset.cmdkGrupo ?? "Menu" });
  });
  return itens;
}

export function CommandPalette() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const abrir = useCallback(() => {
    setItens(lerMenu());
    setBusca("");
    setAtivo(0);
    setAberto(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (aberto) setAberto(false); else abrir();
      } else if (e.key === "Escape" && aberto) {
        setAberto(false);
      }
    };
    const onAbrir = () => abrir();
    window.addEventListener("keydown", onKey);
    window.addEventListener("v3:abrir-busca", onAbrir);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("v3:abrir-busca", onAbrir); };
  }, [aberto, abrir]);

  useEffect(() => { if (aberto) requestAnimationFrame(() => inputRef.current?.focus()); }, [aberto]);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return itens;
    const termos = q.split(" ");
    return itens.filter((i) => { const t = normalizar(`${i.label} ${i.grupo} ${i.href}`); return termos.every((x) => t.includes(x)); });
  }, [busca, itens]);

  useEffect(() => { setAtivo(0); }, [busca]);
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const ir = (i: Item | undefined) => {
    if (!i) return;
    setAberto(false);
    router.push(i.href);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <div className="absolute inset-0 bg-[#09081A]/70 backdrop-blur-sm v3-cmdk-fundo" onClick={() => setAberto(false)} />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#C9A84C]/25 bg-[#111F35] shadow-[0_40px_80px_-30px_rgba(0,0,0,.9),0_0_0_1px_rgba(201,168,76,.06)] overflow-hidden v3-cmdk">
        <div className="flex items-center gap-3 px-4 border-b border-[#243A66]">
          <Search className="w-4 h-4 text-[#C9A84C]" />
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, filtrados.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); ir(filtrados[ativo]); }
            }}
            placeholder="Ir para… (Mesa Operacional, CRM, Comissões)"
            className="flex-1 bg-transparent py-3.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] outline-none"
          />
          <kbd className="text-[10px] text-[#7A8FA8] border border-[#243A66] rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={listaRef} className="max-h-[50vh] overflow-y-auto py-1.5 v3-stagger">
          {filtrados.length === 0 && <p className="px-4 py-6 text-center text-sm text-[#7A8FA8]">Nenhuma tela encontrada.</p>}
          {filtrados.map((i, idx) => (
            <button
              key={i.href}
              data-idx={idx}
              onMouseMove={() => setAtivo(idx)}
              onClick={() => ir(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${idx === ativo ? "bg-[#C9A84C]/10 text-[#F0ECE4]" : "text-[#7A8FA8]"}`}
            >
              <span className={`w-1 h-4 rounded-full transition-colors ${idx === ativo ? "bg-[#C9A84C]" : "bg-transparent"}`} />
              <span className="flex-1 truncate">{i.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-[#7A8FA8]/70">{i.grupo}</span>
              {idx === ativo && <CornerDownLeft className="w-3.5 h-3.5 text-[#C9A84C]" />}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#243A66] text-[10px] text-[#7A8FA8]">
          <span>↑↓ navegar · Enter abrir</span>
          <span><kbd className="border border-[#243A66] rounded px-1">Ctrl</kbd> + <kbd className="border border-[#243A66] rounded px-1">K</kbd></span>
        </div>
      </div>
    </div>
  );
}

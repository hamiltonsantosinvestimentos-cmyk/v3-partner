"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Provider = "anthropic" | "openai" | "openrouter" | "google";

interface ModelInfo { id: string; label: string; tier: string }

interface Agent {
  id: string;
  owner_partner_id: string;
  name: string;
  enabled: boolean;
  channels: string[];
  provider: Provider;
  model: string;
  temperature: number;
  max_tokens: number;
  api_key_hint: string | null;
  has_api_key: boolean;
  system_prompt: string;
  smart_delay_min_ms: number;
  smart_delay_max_ms: number;
  fallback_to_human: boolean;
  updated_at: string;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  google: "Google (Gemini)",
};

const inputCls =
  "w-full rounded-lg bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 placeholder:text-[#3A5070]";
const labelCls = "block text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1";

// ─── Componente ─────────────────────────────────────────────────────────────

export function AgentConfigClient({ owner = "interno" }: { owner?: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Record<Provider, ModelInfo[]>>({
    anthropic: [], openai: [], openrouter: [], google: [],
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Agent> & { api_key?: string }>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sdr/agents?owner=${encodeURIComponent(owner)}`);
      const data = await res.json();
      if (!res.ok) { setErr(typeof data.error === "string" ? data.error : "Falha ao carregar agentes."); return; }
      setAgents(data.agents ?? []);
      setModels(data.models ?? {});
      setErr("");
    } catch {
      setErr("Falha de rede ao carregar agentes.");
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditing("new");
    setDraft({
      name: "Novo agente", enabled: agents.length === 0, channels: ["whatsapp"],
      provider: "anthropic", model: "claude-haiku-4-5", temperature: 0.6, max_tokens: 1024,
      system_prompt: "", smart_delay_min_ms: 1500, smart_delay_max_ms: 6000, fallback_to_human: true,
    });
  }

  function startEdit(a: Agent) {
    setEditing(a.id);
    setDraft({ ...a, api_key: undefined });
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const isNew = editing === "new";
      const body = {
        ...(isNew ? { owner } : { id: editing }),
        name: draft.name, enabled: draft.enabled, channels: draft.channels,
        provider: draft.provider, model: draft.model,
        temperature: draft.temperature, max_tokens: draft.max_tokens,
        system_prompt: draft.system_prompt,
        smart_delay_min_ms: draft.smart_delay_min_ms, smart_delay_max_ms: draft.smart_delay_max_ms,
        fallback_to_human: draft.fallback_to_human,
        ...(draft.api_key ? { api_key: draft.api_key } : {}),
      };
      const res = await fetch("/api/sdr/agents", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      setEditing(null);
      setDraft({});
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
      await load();
    } catch {
      setErr("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este agente?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sdr/agents?id=${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Falha ao remover."); return; }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const modelList = models[(draft.provider ?? "anthropic") as Provider] ?? [];

  if (loading) return <p className="text-sm text-[#7A8FA8] p-4">Carregando agentes…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#F0ECE4]">Agente IA</h2>
          <p className="text-xs text-[#7A8FA8]">
            Provedor, modelo, prompt e comportamento do agente que responde no{" "}
            {owner === "interno" ? "WhatsApp da V3" : "seu WhatsApp"}.
          </p>
        </div>
        {editing === null && (
          <button onClick={startNew}
            className="px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold hover:bg-[#E8C97A]">
            + Novo agente
          </button>
        )}
      </div>

      {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
      {savedAt && <p className="text-xs text-emerald-400">Salvo.</p>}

      {/* Lista */}
      {editing === null && (
        <div className="space-y-2">
          {agents.length === 0 && (
            <p className="text-xs text-[#7A8FA8] italic">Nenhum agente ainda. O runtime usa o prompt legado até você criar um.</p>
          )}
          {agents.map((a) => (
            <div key={a.id} className="rounded-xl border border-[#243A66] bg-[#111F35] p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#F0ECE4] truncate">{a.name}</span>
                  {a.enabled
                    ? <span className="text-[10px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">ativo</span>
                    : <span className="text-[10px] font-bold text-[#7A8FA8] border border-[#243A66] px-1.5 py-0.5 rounded-full">inativo</span>}
                </div>
                <p className="text-[11px] text-[#7A8FA8] mt-0.5">
                  {PROVIDER_LABELS[a.provider]} · {a.model} · temp {a.temperature} · {a.channels.join(", ")}
                  {a.has_api_key ? ` · chave ${a.api_key_hint}` : " · sem chave própria"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => startEdit(a)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#243A66] text-[#7A8FA8] hover:text-white">Editar</button>
                <button onClick={() => remove(a.id)} disabled={busy} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10">Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {editing !== null && (
        <div className="rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nome</label>
              <input className={inputCls} value={draft.name ?? ""} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>

            <div>
              <label className={labelCls}>Provedor</label>
              <select className={inputCls} value={draft.provider ?? "anthropic"}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  setDraft((d) => ({ ...d, provider: p, model: (models[p]?.[0]?.id) ?? "" }));
                }}>
                {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Modelo</label>
              <select className={inputCls} value={draft.model ?? ""} onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}>
                {modelList.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.tier}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>
                Chave de API {draft.provider === "anthropic" ? "(Anthropic)" : draft.provider === "google" ? "(Google AI Studio)" : draft.provider === "openrouter" ? "(OpenRouter)" : "(OpenAI)"}
              </label>
              <input className={inputCls} type="password" autoComplete="off"
                placeholder={editing !== "new" && draft.has_api_key ? `salva: ${draft.api_key_hint} — deixe em branco pra manter` : "cole a chave"}
                value={draft.api_key ?? ""} onChange={(e) => setDraft((d) => ({ ...d, api_key: e.target.value }))} />
              <p className="text-[10px] text-[#3A5070] mt-1">Guardada criptografada. Sem chave própria, cai na chave global da V3 (só Anthropic).</p>
            </div>

            <div>
              <label className={labelCls}>Temperatura ({(draft.temperature ?? 0.6).toFixed(2)})</label>
              <input type="range" min={0} max={1.5} step={0.05} className="w-full accent-[#C9A84C]"
                value={draft.temperature ?? 0.6} onChange={(e) => setDraft((d) => ({ ...d, temperature: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Máx. tokens da resposta</label>
              <input className={inputCls} type="number" min={64} max={8192} step={64}
                value={draft.max_tokens ?? 1024} onChange={(e) => setDraft((d) => ({ ...d, max_tokens: Number(e.target.value) }))} />
            </div>

            <div>
              <label className={labelCls}>Delay humano — mín (ms)</label>
              <input className={inputCls} type="number" min={0} max={60000} step={250}
                value={draft.smart_delay_min_ms ?? 1500} onChange={(e) => setDraft((d) => ({ ...d, smart_delay_min_ms: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Delay humano — máx (ms)</label>
              <input className={inputCls} type="number" min={0} max={60000} step={250}
                value={draft.smart_delay_max_ms ?? 6000} onChange={(e) => setDraft((d) => ({ ...d, smart_delay_max_ms: Number(e.target.value) }))} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>System prompt / persona</label>
              <textarea className={`${inputCls} min-h-[140px] font-mono text-[12px] leading-relaxed`}
                value={draft.system_prompt ?? ""} onChange={(e) => setDraft((d) => ({ ...d, system_prompt: e.target.value }))} />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#F0ECE4]">
              <input type="checkbox" className="accent-[#C9A84C]" checked={draft.enabled ?? false}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} />
              Agente ativo (só um por dono)
            </label>
            <label className="flex items-center gap-2 text-xs text-[#F0ECE4]">
              <input type="checkbox" className="accent-[#C9A84C]" checked={draft.fallback_to_human ?? true}
                onChange={(e) => setDraft((d) => ({ ...d, fallback_to_human: e.target.checked }))} />
              Passar pra humano se a IA falhar
            </label>

            <div className="sm:col-span-2 flex items-center gap-2 flex-wrap">
              {(["whatsapp", "instagram", "messenger", "telegram"] as const).map((ch) => {
                const on = (draft.channels ?? []).includes(ch);
                const label = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", telegram: "Telegram" }[ch];
                return (
                  <button key={ch} type="button"
                    onClick={() => setDraft((d) => {
                      const cur = new Set(d.channels ?? []);
                      if (cur.has(ch)) cur.delete(ch); else cur.add(ch);
                      return { ...d, channels: [...cur] };
                    })}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${on ? "bg-[#C9A84C] text-[#09081A] border-transparent" : "border-[#243A66] text-[#7A8FA8]"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={() => { setEditing(null); setDraft({}); setErr(""); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#243A66] text-[#7A8FA8]">Cancelar</button>
            <button onClick={save} disabled={busy || !(draft.channels ?? []).length}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-60">
              {busy ? "Salvando…" : editing === "new" ? "Criar agente" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

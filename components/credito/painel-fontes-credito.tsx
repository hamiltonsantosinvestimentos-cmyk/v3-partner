"use client";

import { useState } from "react";
import { Search, Loader2, Save, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SourceConfigData {
  cnpj: string;
  razao_social: string | null;
  receita_federal: boolean;
  cnj_datajud: boolean;
  ceis: boolean;
  registrato_bacen: boolean;
  serasa: boolean;
  serasa_modalidade: "simples" | "avancada";
  serasa_cnpj: boolean;
  serasa_cpf: boolean;
  serasa_cpf_list: string[] | null;
  spc: boolean;
  escavador: boolean;
  is_default: boolean;
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 999, border: "1px solid #243A66",
        background: disabled ? "#162744" : checked ? "#C9A84C" : "#162744",
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "background 0.15s", flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: checked ? 20 : 2, width: 16, height: 16,
          borderRadius: "50%", background: disabled ? "#9BAFC5" : checked ? "#09081A" : "#9BAFC5",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function SourceRow({ label, description, checked, disabled, disabledReason, onChange }: {
  label: string; description: string; checked: boolean; disabled?: boolean; disabledReason?: string; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/30 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{disabled && disabledReason ? disabledReason : description}</p>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

export function PainelFontesCredito() {
  const [cnpjInput, setCnpjInput] = useState("");
  const [config, setConfig] = useState<SourceConfigData | null>(null);
  const [cpfListInput, setCpfListInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSearch() {
    const cnpj = cnpjInput.replace(/\D/g, "");
    if (!cnpj) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/credit-engine/source-config?cnpj=${cnpj}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao buscar configuração");
      setConfig(json.data);
      setCpfListInput((json.data.serasa_cpf_list ?? []).join(", "));
    } catch (e) {
      setError((e as Error).message);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/credit-engine/source-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          serasa_cpf_list: config.serasa_cpf ? cpfListInput.split(",").map((s) => s.trim()).filter(Boolean) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setSuccess(true);
      setConfig({ ...config, is_default: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof SourceConfigData>(key: K, value: SourceConfigData[K]) {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          value={cnpjInput}
          onChange={(e) => setCnpjInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="CNPJ do cliente (só números)"
          className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <Button onClick={handleSearch} disabled={loading || !cnpjInput}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <CircleAlert className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {config && (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-1">
          {config.is_default && (
            <p className="text-xs text-amber-400 mb-3">Este cliente ainda não tem configuração salva. Exibindo os valores padrão.</p>
          )}

          <SourceRow label="Receita Federal" description="Situação cadastral, CNAE, capital social, quadro societário" checked={config.receita_federal} onChange={(v) => update("receita_federal", v)} />
          <SourceRow label="CNJ DataJud" description="Processos judiciais (cível, fiscal e trabalhista)" checked={config.cnj_datajud} onChange={(v) => update("cnj_datajud", v)} />
          <SourceRow label="CEIS" description="Sanções administrativas e impedimentos de contratar" checked={config.ceis} onChange={(v) => update("ceis", v)} />
          <SourceRow label="Registrato BACEN" description="Relacionamento bancário. Requer consentimento do titular (LGPD)" checked={config.registrato_bacen} onChange={(v) => update("registrato_bacen", v)} />

          <div className="py-3 border-b border-border/30">
            <SourceRow
              label="Serasa"
              description="Nó ainda é stub no workflow, não retorna dado real hoje"
              checked={config.serasa}
              disabled
              disabledReason="Nó ainda é stub no workflow, não retorna dado real hoje"
              onChange={(v) => update("serasa", v)}
            />
            <div className="mt-3 pl-1 space-y-3 opacity-50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0">Modalidade</span>
                <select disabled value={config.serasa_modalidade} className="bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground">
                  <option value="simples">Simples</option>
                  <option value="avancada">Avançada</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Consultar CNPJ</span>
                <Toggle checked={config.serasa_cnpj} disabled onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Consultar CPF (sócios/avalistas)</span>
                <Toggle checked={config.serasa_cpf} disabled onChange={() => {}} />
              </div>
              {config.serasa_cpf && (
                <input disabled value={cpfListInput} placeholder="CPFs separados por vírgula" className="w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-xs text-muted-foreground" />
              )}
            </div>
          </div>

          <SourceRow label="SPC" description="Nó ainda é stub no workflow, não retorna dado real hoje" checked={config.spc} disabled disabledReason="Nó ainda é stub no workflow, não retorna dado real hoje" onChange={(v) => update("spc", v)} />
          <SourceRow label="Escavador" description="Histórico judicial ampliado e patrimonial" checked={config.escavador} disabled disabledReason="Token validado, mas conta sem saldo" onChange={(v) => update("escavador", v)} />

          <div className="pt-4 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar configuração
            </Button>
            {success && <span className="text-xs text-emerald-400">Salvo com sucesso</span>}
          </div>
        </div>
      )}

      {!config && !loading && (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
          Busque um CNPJ para ver ou configurar as fontes.
        </div>
      )}
    </div>
  );
}

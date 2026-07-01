"use client";

import { useState } from "react";
import { Key, CheckCircle2, Clock, ExternalLink, AlertCircle, Loader2, Building2, Shield } from "lucide-react";

type IntegrationPartner = {
  id: string;
  name: string;
  display_name: string;
  crm_type: string;
  active: boolean;
  sla_days: number;
  has_api_key: boolean;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function IntegracoesClient({
  partners: initialPartners,
  userRole,
}: {
  partners: IntegrationPartner[];
  userRole: string;
}) {
  const [partners, setPartners] = useState<IntegrationPartner[]>(initialPartners);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canEdit = ["ADMIN", "GESTAO"].includes(userRole);

  async function handleSaveKey(partnerId: string) {
    const key = apiKeyInputs[partnerId]?.trim();
    if (!key) {
      setErrors(e => ({ ...e, [partnerId]: "Cole a API key antes de salvar." }));
      return;
    }
    setSaving(s => ({ ...s, [partnerId]: true }));
    setErrors(e => ({ ...e, [partnerId]: "" }));
    try {
      const res = await fetch(`/api/integrations/${partnerId}/api-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      const json = await res.json() as { partner?: IntegrationPartner; message?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setPartners(ps => ps.map(p => p.id === partnerId ? { ...p, active: true, has_api_key: true } : p));
      setSaved(s => ({ ...s, [partnerId]: json.message ?? "API key salva." }));
      setApiKeyInputs(i => ({ ...i, [partnerId]: "" }));
    } catch (err) {
      setErrors(e => ({ ...e, [partnerId]: (err as Error).message }));
    } finally {
      setSaving(s => ({ ...s, [partnerId]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-[#09081A] text-[#F5F1E8] p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold tracking-[2px] uppercase text-[#E8C97A]">
            Configurações
          </span>
          <span className="text-[#243A66]">/</span>
          <span className="text-[9px] font-bold tracking-[2px] uppercase text-[#9BAFC5]">
            Integrações
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[#F5F1E8]">Painel de Integrações</h1>
        <p className="text-sm text-[#9BAFC5] mt-1">
          Gerencie as conexões com securitizadoras e CRMs parceiros. API keys são armazenadas de forma segura.
        </p>
      </div>

      {/* Cards de parceiros */}
      <div className="space-y-4 max-w-2xl">
        {partners.length === 0 && (
          <div className="rounded-xl border border-[#243A66] bg-[#13223A] p-8 text-center">
            <Building2 className="w-8 h-8 text-[#9BAFC5] mx-auto mb-3" />
            <p className="text-sm text-[#9BAFC5]">Nenhuma integração cadastrada.</p>
          </div>
        )}

        {partners.map(partner => (
          <div key={partner.id} className="rounded-xl border border-[#243A66] bg-[#13223A] overflow-hidden">
            {/* Card header */}
            <div className="flex items-start justify-between p-5 border-b border-[#1E3A5F]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#162744] border border-[#243A66] flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#F5F1E8] text-sm">{partner.display_name}</h3>
                  <span className="text-[10px] text-[#9BAFC5] uppercase tracking-wide">{partner.crm_type}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#9BAFC5]">SLA {partner.sla_days}d</span>
                {partner.active ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    <CheckCircle2 className="w-3 h-3" /> Ativo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    <Clock className="w-3 h-3" /> Aguardando
                  </span>
                )}
              </div>
            </div>

            {/* Card body */}
            <div className="p-5 space-y-4">
              {/* Status da API key */}
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#9BAFC5] flex-shrink-0" />
                {partner.has_api_key ? (
                  <p className="text-xs text-emerald-400">API key configurada — integração pronta.</p>
                ) : (
                  <p className="text-xs text-[#9BAFC5]">
                    API key não configurada — solicitar ao parceiro e inserir abaixo.
                  </p>
                )}
              </div>

              {/* Form de inserção de API key */}
              {canEdit && (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#E8C97A]">
                    {partner.has_api_key ? "Atualizar API Key" : "Inserir API Key"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInputs[partner.id] ?? ""}
                      onChange={e => setApiKeyInputs(i => ({ ...i, [partner.id]: e.target.value }))}
                      placeholder="Cole a API key aqui..."
                      className="flex-1 rounded-lg bg-[#09081A] border border-[#243A66] text-[#F5F1E8] text-xs px-3 py-2 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C9A84C]/60"
                    />
                    <button
                      onClick={() => handleSaveKey(partner.id)}
                      disabled={saving[partner.id] || !apiKeyInputs[partner.id]?.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-semibold hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {saving[partner.id]
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Key className="w-3 h-3" />
                      }
                      Salvar
                    </button>
                  </div>
                  {errors[partner.id] && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors[partner.id]}
                    </p>
                  )}
                  {saved[partner.id] && (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {saved[partner.id]}
                    </p>
                  )}
                </div>
              )}

              {/* Config info */}
              {typeof partner.config_json?.form_url === "string" && (
                <a
                  href={partner.config_json.form_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-[#9BAFC5] hover:text-[#C9A84C] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Acessar formulário do parceiro
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Nota de segurança */}
      <div className="mt-8 max-w-2xl rounded-xl border border-[#1E3A5F] bg-[#13223A]/50 p-4 flex gap-3">
        <Shield className="w-4 h-4 text-[#9BAFC5] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#F5F1E8] mb-1">Segurança das API Keys</p>
          <p className="text-xs text-[#9BAFC5]">
            As chaves são armazenadas criptografadas no banco de dados e nunca expostas via APIs públicas.
            Acesso restrito a roles ADMIN e GESTAO. Rotacione periodicamente conforme política do parceiro.
          </p>
        </div>
      </div>
    </div>
  );
}

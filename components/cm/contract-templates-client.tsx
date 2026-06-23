"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Save, Trash2, Loader2, FileText, Eye, ChevronDown, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  template_name: string;
  vertical: string;
  body_text_raw: string;
  variables_map: any[];
  version: number;
  is_active: boolean;
  created_at: string;
}

const VERTICAL_LABELS: Record<string, string> = {
  capital_markets: "Bolsa de Ativos",
  credito: "Mesa de Crédito",
  ma: "M&A",
  institucional: "Institucional",
  clientes: "Clientes / Partners",
  talent_pool: "Talent Pool",
  colaboradores: "Colaboradores",
};

const VERTICAL_COLORS: Record<string, string> = {
  capital_markets: "bg-[#C9A84C] text-[#09081A]",
  credito: "bg-emerald-500 text-white",
  ma: "bg-blue-500 text-white",
  institucional: "bg-purple-500 text-white",
  clientes: "bg-orange-500 text-white",
  talent_pool: "bg-cyan-500 text-[#09081A]",
  colaboradores: "bg-pink-500 text-white",
};

const SAMPLE_VARS = `Variáveis disponíveis (use entre {{chaves}}):

CEDENTE: {{nome_cedente}}, {{cpf_cnpj_cedente}}
ATIVO: {{tipo_ativo}}, {{anonymous_id}}, {{ente_devedor}}, {{esfera}}, {{tribunal}}, {{natureza}}, {{numero_processo}}
FINANCEIRO: {{valor_face}}, {{valor_atualizado}}, {{desagio_pretendido}}, {{prazo_estimado_meses}}
OFERTA: {{valor_oferta}}, {{desagio_oferecido}}, {{tipo_pagamento}}
COMISSAO: {{comissao_total}}, {{comissao_v3}}, {{comissao_partner}}, {{comissao_intermediario}}
M&A: {{nome_ativo}}, {{valor_deal}}, {{setor}}, {{v3_code}}
SISTEMA: {{data_geracao}}, {{data_geracao_extenso}}`;

export function ContractTemplatesClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterVertical, setFilterVertical] = useState("");

  const [formName, setFormName] = useState("");
  const [formVertical, setFormVertical] = useState("capital_markets");
  const [formBody, setFormBody] = useState("");
  const [showVars, setShowVars] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterVertical ? `?vertical=${filterVertical}` : "";
      const res = await fetch(`/api/contracts/templates${params}`);
      const json = await res.json();
      setTemplates(json.templates ?? []);
    } catch { }
    finally { setLoading(false); }
  }, [filterVertical]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const selectTemplate = (t: Template) => {
    setSelected(t);
    setIsNew(false);
    setFormName(t.template_name);
    setFormVertical(t.vertical);
    setFormBody(t.body_text_raw);
  };

  const startNew = () => {
    setSelected(null);
    setIsNew(true);
    setFormName("");
    setFormVertical("capital_markets");
    setFormBody("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contracts/templates/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { alert(json.error); return; }
      setSelected(null);
      setIsNew(true);
      setFormName(json.suggested_name);
      setFormVertical("capital_markets");
      setFormBody(json.body_text);
    } catch { alert("Erro ao fazer upload"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!formName || !formBody) return;
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch("/api/contracts/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_name: formName, vertical: formVertical, body_text_raw: formBody }),
        });
        if (res.ok) { setIsNew(false); fetchTemplates(); }
        else { const j = await res.json(); alert(j.error); }
      } else if (selected) {
        const res = await fetch(`/api/contracts/templates/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_name: formName, body_text_raw: formBody }),
        });
        if (res.ok) fetchTemplates();
        else { const j = await res.json(); alert(j.error); }
      }
    } catch { alert("Erro de conexão"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Desativar este template?")) return;
    await fetch(`/api/contracts/templates/${id}`, { method: "DELETE" });
    setSelected(null);
    fetchTemplates();
  };

  const detectedVars = (formBody.match(/\{\{([^}]+)\}\}/g) || []).map(v => v.replace(/\{\{|\}\}/g, "").trim());

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Central de Contratos</h1>
          <p className="text-sm text-[#9BAFC5]">Biblioteca de minutas com injeção automática de variáveis</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] transition">
          <Plus size={16} /> Nova Minuta
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {["", "capital_markets", "credito", "ma", "institucional", "clientes", "talent_pool", "colaboradores"].map((v) => (
          <button key={v} onClick={() => setFilterVertical(v)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition",
              filterVertical === v ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#162744] text-[#9BAFC5] hover:text-[#F5F1E8]"
            )}>
            {v ? VERTICAL_LABELS[v] : "Todas"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lista de templates */}
        <div className="col-span-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#C9A84C]" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">Nenhuma minuta cadastrada</div>
          ) : templates.map((t) => (
            <div key={t.id} onClick={() => selectTemplate(t)}
              className={cn("bg-[#12112A] border rounded-lg p-4 cursor-pointer transition",
                selected?.id === t.id ? "border-[#C9A84C]/50" : "border-[#9BAFC5]/10 hover:border-[#C9A84C]/20"
              )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded", VERTICAL_COLORS[t.vertical])}>
                  {VERTICAL_LABELS[t.vertical]}
                </span>
                <span className="text-[9px] text-[#9BAFC5]">v{t.version}</span>
              </div>
              <div className="text-sm font-bold text-[#F5F1E8]">{t.template_name}</div>
              <div className="text-[10px] text-[#9BAFC5] mt-1">
                {(t.variables_map?.length ?? 0)} variáveis · {new Date(t.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="col-span-8">
          {!isNew && !selected ? (
            <div className="flex items-center justify-center h-64 text-[#9BAFC5] text-sm">
              Selecione uma minuta ou clique em "Nova Minuta"
            </div>
          ) : (
            <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Nome da Minuta</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none"
                    placeholder="Ex: Termo de Cessão de Crédito" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Vertical</label>
                  <select value={formVertical} onChange={(e) => setFormVertical(e.target.value)}
                    disabled={!isNew}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] disabled:opacity-50">
                    <option value="capital_markets">Bolsa de Ativos</option>
                    <option value="credito">Mesa de Crédito</option>
                    <option value="ma">M&A</option>
                    <option value="institucional">Institucional</option>
                    <option value="clientes">Clientes / Partners</option>
                    <option value="talent_pool">Talent Pool</option>
                    <option value="colaboradores">Colaboradores</option>
                  </select>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 bg-[#162744] text-[#F5F1E8] border border-[#9BAFC5]/20 rounded-lg text-xs font-medium hover:bg-[#243A66] disabled:opacity-40 transition"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Processando..." : "Importar documento (.txt, .docx, .pdf)"}
                </button>
                <span className="text-[10px] text-[#9BAFC5]">Anexe um arquivo para preencher o corpo da minuta automaticamente</span>
              </div>

              <div className="mb-2 flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Corpo da Minuta</label>
                <button onClick={() => setShowVars(!showVars)} className="flex items-center gap-1 text-[10px] text-[#9BAFC5] hover:text-[#C9A84C] transition">
                  <ChevronDown size={12} className={showVars ? "rotate-180" : ""} /> Variaveis
                </button>
              </div>

              {showVars && (
                <div className="bg-[#09081A] border border-[#9BAFC5]/10 rounded-lg p-3 mb-3 text-[10px] text-[#9BAFC5] whitespace-pre-wrap font-mono">
                  {SAMPLE_VARS}
                </div>
              )}

              <textarea value={formBody} onChange={(e) => setFormBody(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-3 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none font-mono min-h-[350px] resize-y"
                placeholder="Digite o texto da minuta usando {{variáveis}} entre chaves..." />

              {detectedVars.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detectedVars.map((v, i) => (
                    <span key={i} className="text-[9px] bg-[#C9A84C]/10 text-[#C9A84C] px-2 py-0.5 rounded border border-[#C9A84C]/20">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div>
                  {selected && (
                    <button onClick={() => handleDelete(selected.id)}
                      className="flex items-center gap-2 px-3 py-2 text-red-400 text-xs hover:bg-red-500/10 rounded-lg transition">
                      <Trash2 size={14} /> Desativar
                    </button>
                  )}
                </div>
                <button onClick={handleSave} disabled={saving || !formName || !formBody}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-40 transition">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isNew ? "Criar Minuta" : "Salvar Alterações"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

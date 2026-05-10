"use client";

import React, { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, DollarSign, Tag, Loader2, AlertCircle, CheckCircle, ImagePlus, Paperclip, X, FileText, Upload } from "lucide-react";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";

interface UploadedFile {
  url: string;
  name: string;
  path: string;
}

function ImageUploader({ supplierId, images, onAdd, onRemove }: {
  supplierId: string;
  images: UploadedFile[];
  onAdd: (f: UploadedFile) => void;
  onRemove: (i: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || images.length >= 8) return;
    setError("");
    setUploading(true);
    for (const file of Array.from(files)) {
      if (images.length >= 8) break;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      try {
        const res = await fetch("/api/marketplace/upload", {
          method: "POST",
          headers: { "x-supplier-id": supplierId },
          body: fd,
        });
        const j = await res.json();
        if (!res.ok) { setError(j.error ?? "Erro no upload"); break; }
        onAdd(j);
      } catch {
        setError("Erro ao enviar imagem");
        break;
      }
    }
    setUploading(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-[#C9A84C]" />
          <h3 className="text-[#F0ECE4] font-semibold text-sm">Fotos do Produto</h3>
        </div>
        <span className="text-[#7A8FA8] text-xs">{images.length}/8 imagens</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {images.map((img, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[#1B3050] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < 8 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-lg border-2 border-dashed border-[#1B3050] hover:border-[#C9A84C]/50 flex flex-col items-center justify-center gap-1 text-[#7A8FA8] hover:text-[#C9A84C] transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <p className="text-[#7A8FA8] text-xs">JPG, PNG, WEBP até 5MB cada. Primeira imagem será a capa.</p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

function AttachmentUploader({ supplierId, attachments, onAdd, onRemove }: {
  supplierId: string;
  attachments: UploadedFile[];
  onAdd: (f: UploadedFile) => void;
  onRemove: (i: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "attachment");
      try {
        const res = await fetch("/api/marketplace/upload", {
          method: "POST",
          headers: { "x-supplier-id": supplierId },
          body: fd,
        });
        const j = await res.json();
        if (!res.ok) { setError(j.error ?? "Erro no upload"); break; }
        onAdd(j);
      } catch {
        setError("Erro ao enviar arquivo");
        break;
      }
    }
    setUploading(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-[#C9A84C]" />
        <h3 className="text-[#F0ECE4] font-semibold text-sm">Documentos / Anexos <span className="text-[#7A8FA8] font-normal">(opcional)</span></h3>
      </div>

      {attachments.map((att, i) => (
        <div key={i} className="flex items-center gap-3 bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5">
          <FileText className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
          <span className="text-[#F0ECE4] text-sm flex-1 truncate">{att.name}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-[#7A8FA8] hover:text-red-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#1B3050] hover:border-[#C9A84C]/50 rounded-lg text-[#7A8FA8] hover:text-[#C9A84C] text-sm transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        {uploading ? "Enviando..." : "Anexar documento"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <p className="text-[#7A8FA8] text-xs">PDF, Word, Excel até 20MB. Ex: ficha técnica, catálogo, tabela de preços.</p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

function NovoProdutoForm() {
  useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplier_id");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: MARKETPLACE_CATEGORIES[0],
    price: "",
    price_type: "FIXED" as "FIXED" | "NEGOTIABLE" | "ON_REQUEST",
    commission_percent: "10",
    min_order: "",
    delivery_days: "",
    available_nationwide: true,
    specs_keys: [""],
    specs_vals: [""],
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function addSpec() {
    setForm(prev => ({ ...prev, specs_keys: [...prev.specs_keys, ""], specs_vals: [...prev.specs_vals, ""] }));
  }

  function removeSpec(i: number) {
    setForm(prev => ({
      ...prev,
      specs_keys: prev.specs_keys.filter((_, idx) => idx !== i),
      specs_vals: prev.specs_vals.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) { setError("ID do fornecedor não encontrado"); return; }

    const specs: Record<string, string> = {};
    form.specs_keys.forEach((k, i) => { if (k.trim()) specs[k.trim()] = form.specs_vals[i] ?? ""; });

    // Store attachment URLs in specs with special prefix
    if (attachments.length > 0) {
      attachments.forEach((att, i) => {
        specs[`_anexo_${i + 1}`] = att.url;
        specs[`_anexo_${i + 1}_nome`] = att.name;
      });
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/marketplace/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-supplier-id": supplierId },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          category: form.category,
          price: form.price_type !== "ON_REQUEST" && form.price ? parseFloat(form.price) : null,
          price_type: form.price_type,
          commission_percent: parseFloat(form.commission_percent),
          min_order: form.min_order ? parseInt(form.min_order) : null,
          delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
          available_nationwide: form.available_nationwide,
          specs,
          images: images.map(img => img.url),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(typeof j.error === "string" ? j.error : "Erro ao cadastrar produto");
      }
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar produto");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSuccess(false);
    setImages([]);
    setAttachments([]);
    setForm({ name: "", description: "", category: MARKETPLACE_CATEGORIES[0], price: "", price_type: "FIXED", commission_percent: "10", min_order: "", delivery_days: "", available_nationwide: true, specs_keys: [""], specs_vals: [""] });
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#F0ECE4]">Produto enviado!</h2>
          <p className="text-[#7A8FA8]">Seu produto foi cadastrado e está aguardando aprovação da V3 Partners. Geralmente leva até 1 dia útil.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/fornecedor/dashboard" className="px-5 py-2.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors">
              Voltar ao Dashboard
            </Link>
            <button onClick={resetForm}
              className="px-5 py-2.5 bg-[#0D1929] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4] font-semibold rounded-xl text-sm transition-colors">
              Novo Produto
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!supplierId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-[#F0ECE4]">Sessão inválida. Faça login novamente.</p>
          <Link href="/fornecedor/login" className="text-[#C9A84C] underline text-sm">Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09081A] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/fornecedor/dashboard" className="p-2 rounded-lg bg-[#0D1929] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#F0ECE4]">Cadastrar Produto</h1>
            <p className="text-[#7A8FA8] text-sm">Preencha os dados do produto ou serviço</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-[#F0ECE4] font-semibold text-sm">Informações do Produto</h3>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Nome do Produto / Serviço *</label>
              <input required value={form.name} onChange={e => set("name", e.target.value)}
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                placeholder="Ex: Equipamento de Fisioterapia Profissional" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Categoria *</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
                <select value={form.category} onChange={e => set("category", e.target.value as typeof form.category)}
                  className="w-full appearance-none bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50">
                  {MARKETPLACE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Descrição Completa *</label>
              <textarea required value={form.description} onChange={e => set("description", e.target.value)}
                rows={5}
                placeholder="Descreva detalhadamente o produto/serviço, seus diferenciais, como funciona, para quem é indicado..."
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40 resize-none" />
            </div>
          </div>

          {/* Images */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
            <ImageUploader
              supplierId={supplierId}
              images={images}
              onAdd={f => setImages(prev => [...prev, f])}
              onRemove={i => setImages(prev => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          {/* Attachments */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
            <AttachmentUploader
              supplierId={supplierId}
              attachments={attachments}
              onAdd={f => setAttachments(prev => [...prev, f])}
              onRemove={i => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          {/* Pricing */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-[#F0ECE4] font-semibold text-sm">Preço e Comissão</h3>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-2">Tipo de Preço *</label>
              <div className="flex gap-2">
                {([
                  { v: "FIXED", label: "Preço Fixo" },
                  { v: "NEGOTIABLE", label: "Negociável" },
                  { v: "ON_REQUEST", label: "Sob Consulta" },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button" onClick={() => set("price_type", v)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      form.price_type === v ? "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40" : "bg-[#111F35] text-[#7A8FA8] border-[#1B3050] hover:text-[#F0ECE4]"
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            {form.price_type !== "ON_REQUEST" && (
              <div>
                <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">
                  {form.price_type === "NEGOTIABLE" ? "Valor a partir de (R$)" : "Valor (R$) *"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required={form.price_type === "FIXED"}
                  value={form.price}
                  onChange={e => set("price", e.target.value)}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                  placeholder="0,00"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">
                Comissão oferecida à V3 Partners (%) *
              </label>
              <input
                type="number"
                min="1"
                max="80"
                step="0.5"
                required
                value={form.commission_percent}
                onChange={e => set("commission_percent", e.target.value)}
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50"
              />
              <p className="text-[#7A8FA8] text-xs mt-1">A V3 Partners definirá a parcela que será repassada para os partners na aprovação.</p>
            </div>
          </div>

          {/* Specs */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-3">
            <h3 className="text-[#F0ECE4] font-semibold text-sm">Especificações Técnicas <span className="text-[#7A8FA8] font-normal">(opcional)</span></h3>
            {form.specs_keys.map((k, i) => (
              <div key={i} className="flex gap-2">
                <input value={k} onChange={e => setForm(prev => { const ks = [...prev.specs_keys]; ks[i] = e.target.value; return { ...prev, specs_keys: ks }; })}
                  placeholder="Ex: Potência"
                  className="flex-1 bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40" />
                <input value={form.specs_vals[i] ?? ""} onChange={e => setForm(prev => { const vs = [...prev.specs_vals]; vs[i] = e.target.value; return { ...prev, specs_vals: vs }; })}
                  placeholder="Ex: 500W"
                  className="flex-1 bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40" />
                {form.specs_keys.length > 1 && (
                  <button type="button" onClick={() => removeSpec(i)} className="px-3 py-2 text-red-400 hover:text-red-300 text-xs">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addSpec} className="text-[#C9A84C] text-xs hover:underline">+ Adicionar especificação</button>
          </div>

          {/* Logistics */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
            <h3 className="text-[#F0ECE4] font-semibold text-sm">Logística</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Pedido Mínimo (unid.)</label>
                <input type="number" min="1" value={form.min_order} onChange={e => set("min_order", e.target.value)}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                  placeholder="1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Prazo Entrega (dias)</label>
                <input type="number" min="1" value={form.delivery_days} onChange={e => set("delivery_days", e.target.value)}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                  placeholder="7" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set("available_nationwide", !form.available_nationwide)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.available_nationwide ? "bg-[#C9A84C]" : "bg-[#1B3050]"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.available_nationwide ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[#F0ECE4] text-sm">Disponível em todo o Brasil</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            {loading ? "Cadastrando produto..." : "Cadastrar Produto"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NovoProdutoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" /></div>}>
      <NovoProdutoForm />
    </Suspense>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, MapPin, FileText, TrendingUp, Scale, Users, Paperclip, Send,
  ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Loader2, X, Upload,
  AtSign, Briefcase, Globe,
} from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  // Step 1 — Identificação
  target_company:     z.string().min(2, "Obrigatório"),
  tipo_participante:  z.enum(["Vendedor", "Investidor"]),
  sector:             z.string().min(1, "Selecione o setor"),
  deal_type:          z.string().min(1, "Selecione o tipo"),
  location:           z.string().min(2, "Ex: São Paulo · SP"),
  cnpj:               z.string().optional(),
  founding_year:      z.string().optional(),
  instagram:          z.string().optional(),
  linkedin:           z.string().optional(),
  website_url:        z.string().optional(),

  // Step 2 — Descrição
  descricao:          z.string().min(30, "Mínimo 30 caracteres"),
  produtos_servicos:  z.string().min(20, "Mínimo 20 caracteres"),
  diferenciais:       z.string().optional(),
  mercado_atendido:   z.string().optional(),

  // Step 3 — Financeiro
  receita_2023:       z.string().optional(),
  receita_2024:       z.string().optional(),
  receita_2025:       z.string().optional(),
  ebitda_2023:        z.string().optional(),
  ebitda_2024:        z.string().optional(),
  ebitda_2025:        z.string().optional(),
  lucro_2023:         z.string().optional(),
  lucro_2024:         z.string().optional(),
  lucro_2025:         z.string().optional(),
  divida_total:       z.string().optional(),
  deal_value:         z.string().min(1, "Informe o valor pretendido"),

  // Step 4 — Jurídico
  licencas:           z.string().optional(),
  tem_processos:      z.enum(["sim", "nao"]),
  detalhes_processos: z.string().optional(),
  tem_pendencias:     z.enum(["sim", "nao"]),

  // Step 5 — Contato & Comissionamento
  contato_nome:       z.string().min(2, "Obrigatório"),
  contato_email:      z.string().email("Email inválido"),
  contato_telefone:   z.string().min(10, "Mínimo 10 dígitos"),
  info_adicionais:    z.string().optional(),
  comissionamento:    z.string().optional(),

  // Step 6 — Documentos
  documentos_info:    z.string().optional(), // metadados dos arquivos (nomes)
});

type FormData = z.infer<typeof schema>;

// ── Constantes ────────────────────────────────────────────────────────────────

const SETORES = [
  "Agropecuária",
  "Asset Management",
  "Corretagem",
  "Crédito Estruturado",
  "Educação",
  "Energia Solar",
  "Fintech",
  "Indústria",
  "Infraestrutura",
  "Mineração · Metais",
  "Mineração · Pedras Preciosas",
  "Real Estate",
  "Saúde",
  "Seguros",
  "Varejo",
  "Outro",
];

const TIPOS_DEAL = [
  "Venda Total (100%)", "Venda Parcial", "Joint Venture",
  "Captação de Capital", "Fusão", "Aquisição Estratégica",
];

const TIPOS_DOCUMENTO = [
  "Contrato Social",
  "Balanço Patrimonial",
  "DRE",
  "Certidão Negativa",
  "Licença / Alvará",
  "Laudo Técnico",
  "Outros",
];

const STEPS = [
  { id: 1, label: "Identificação",  icon: Building2  },
  { id: 2, label: "Descrição",      icon: FileText    },
  { id: 3, label: "Financeiro",     icon: TrendingUp  },
  { id: 4, label: "Jurídico",       icon: Scale       },
  { id: 5, label: "Contato",        icon: Users       },
  { id: 6, label: "Documentos",     icon: Paperclip   },
];

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMoney(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
}

function generateCode(): string {
  const y = new Date().getFullYear().toString().slice(-2);
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `MA-${y}-${n}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-[#F0ECE4]">{label}</Label>
      {children}
    </div>
  );
}

function Textarea({ error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div>
      <textarea
        {...props}
        className={`w-full min-h-[90px] rounded-lg border px-3 py-2 text-sm bg-[#162744] text-[#F0ECE4] placeholder:text-[#7A8FA8] resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition ${error ? "border-red-500/60" : "border-[#243A66]"} ${props.className ?? ""}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function MoneyInput({ label, name, register, placeholder = "0,00" }: {
  label: string; name: string; register: ReturnType<typeof useForm<FormData>>["register"]; placeholder?: string;
}) {
  return (
    <FieldGroup label={label}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C9A84C]">R$</span>
        <input
          {...register(name as keyof FormData)}
          placeholder={placeholder}
          className="w-full h-9 rounded-lg border border-[#243A66] bg-[#162744] pl-9 pr-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition"
        />
      </div>
    </FieldGroup>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                done   ? "bg-[#C9A84C] border-[#C9A84C] text-[#09081A]" :
                active ? "bg-[#162744] border-[#C9A84C] text-[#C9A84C]" :
                         "bg-[#162744] border-[#243A66] text-[#7A8FA8]"
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : step.id}
              </div>
              <span className={`text-[9px] font-semibold tracking-wide uppercase whitespace-nowrap ${active ? "text-[#C9A84C]" : done ? "text-[#C9A84C]/60" : "text-[#7A8FA8]"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 mx-1 mb-5 transition-all ${done ? "bg-[#C9A84C]/50" : "bg-[#243A66]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Formulário Principal ──────────────────────────────────────────────────────

interface NovoDealFormProps {
  isDemo: boolean;
  userId: string;
  onSuccess?: (dealId: string, code: string) => void;
  onCancel?: () => void;
}

export function NovoDealForm({ isDemo, userId, onSuccess, onCancel }: NovoDealFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tem_processos: "nao", tem_pendencias: "nao", tipo_participante: "Vendedor" },
  });

  const temProcessos = watch("tem_processos");

  // ── Validação por step ──
  const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
    1: ["target_company", "tipo_participante", "sector", "deal_type", "location"],
    2: ["descricao", "produtos_servicos"],
    3: ["deal_value"],
    4: ["tem_processos", "tem_pendencias"],
    5: ["contato_nome", "contato_email", "contato_telefone"],
    6: [],
  };

  async function nextStep() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep(s => Math.min(s + 1, 6));
  }

  function prevStep() { setStep(s => Math.max(s - 1, 1)); }

  // ── Upload handlers ──
  function processFiles(incoming: FileList | File[]) {
    setUploadError(null);
    const files = Array.from(incoming);
    const remaining = MAX_FILES - uploadedFiles.length;

    if (files.length > remaining) {
      setUploadError(`Máximo de ${MAX_FILES} arquivos. Você pode adicionar mais ${remaining}.`);
    }

    const valid: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(`Tipo não suportado: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`Arquivo muito grande (máx 10MB): ${file.name}`);
        continue;
      }
      valid.push(file);
    }

    if (valid.length > 0) {
      setUploadedFiles(prev => [...prev, ...valid]);
    }
  }

  function removeFile(index: number) {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files);
    // reset input so same file can be re-added after removal
    e.target.value = "";
  }

  // ── Submit ──
  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);

    // Código de exibição usado APENAS no modo demo. No fluxo real quem emite é
    // o servidor (next_v3_code), e o código volta na resposta da API. Antes
    // este formulário gerava MA-26-{5 dígitos aleatórios}, que é a origem dos
    // códigos fora de padrão como MA-26-37682 e o motivo de a contagem de
    // ma_deals ter se descolado da numeração real.
    const demoCode = generateCode();

    const assetData = {
      // Step 1 — Identificação
      tipo_participante: data.tipo_participante,
      tipoOperacao:      data.deal_type,
      cnpj:              data.cnpj ?? "",
      founding_year:     data.founding_year ?? "",

      // Step 2 — Descrição
      descricao_ptbr:    data.descricao,
      produtos_servicos: data.produtos_servicos,
      tese_investimento: data.diferenciais ?? "",
      diferenciais:      data.diferenciais?.split("\n").filter(Boolean) ?? [],
      mercado_atendido:  data.mercado_atendido ?? "",

      // Step 3 — Financeiro
      financeiro: {
        receita: { 2023: data.receita_2023, 2024: data.receita_2024, 2025: data.receita_2025 },
        ebitda:  { 2023: data.ebitda_2023,  2024: data.ebitda_2024,  2025: data.ebitda_2025  },
        lucro:   { 2023: data.lucro_2023,   2024: data.lucro_2024,   2025: data.lucro_2025   },
      },
      divida_total: data.divida_total ?? "",
      metricas: [
        ...(data.receita_2025 ? [{ label: "Receita 2025", value: `R$ ${data.receita_2025}`, sub: "Receita bruta" }] : []),
        ...(data.ebitda_2025  ? [{ label: "EBITDA 2025",  value: `R$ ${data.ebitda_2025}`,  sub: "Margem operacional" }] : []),
        ...(data.divida_total ? [{ label: "Dívida Total", value: `R$ ${data.divida_total}`, sub: "Posição atual" }] : []),
      ],

      // Step 4 — Jurídico
      juridico: {
        licencas:           data.licencas ?? "",
        tem_processos:      data.tem_processos === "sim",
        detalhes_processos: data.detalhes_processos ?? "",
        tem_pendencias:     data.tem_pendencias === "sim",
      },

      // Step 5 — Contato
      contato: {
        nome:     data.contato_nome,
        email:    data.contato_email,
        telefone: data.contato_telefone,
      },
      comissionamento: data.comissionamento ?? "",
      info_adicionais: data.info_adicionais ?? "",

      // Redes Sociais
      redes_sociais: {
        instagram:   data.instagram ?? "",
        linkedin:    data.linkedin ?? "",
        website_url: data.website_url ?? "",
      },

      // Step 6 — Documentos
      documentos: uploadedFiles.map(f => ({ nome: f.name, tamanho: f.size, tipo: f.type })),

      // processo_v3 não é mais preenchido aqui: o gerador de criativos já usa
      // deal.code como fallback, e esse agora é o código canônico da operação.
    };

    const dealPayload = {
      code:           demoCode,
      title:          `${data.deal_type} — ${data.target_company}`,
      target_company: data.target_company,
      sector:         data.sector,
      location:       data.location,
      deal_value:     parseMoney(data.deal_value),
      stage:          "PROSPECTING" as const,
      status:         "PENDING" as const,
      probability_percent: 10,
      created_by:     userId,
      slug:           data.target_company.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      asset_data:     assetData,
      notes:          data.info_adicionais ?? "",
    };

    if (isDemo) {
      await new Promise(r => setTimeout(r, 1500));
      if (onSuccess) { onSuccess("demo-id", demoCode); return; }
      router.push("/mesa-ma");
      return;
    }

    try {
      const res = await fetch("/api/ma-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company:             data.target_company,
          title:               `${data.deal_type} — ${data.target_company}`,
          sector:              data.sector,
          value:               parseMoney(data.deal_value),
          notes:               data.info_adicionais ?? "",
          tipo_participante:   data.tipo_participante,
          location:            data.location,
          asset_data:          assetData,
          probability_percent: 10,
        }),
      });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(text); } catch { /* resposta não-JSON */ }
      if (!res.ok || !(json.card as Record<string, unknown>)?.id) {
        throw new Error(typeof json.error === "string" ? json.error : `Erro ao salvar (${res.status}). Tente novamente.`);
      }
      const dealId = (json.card as Record<string, unknown>).id as string;
      // Código real emitido pelo servidor. É este que o usuário vê e que vai
      // para contrato, pasta de deal e VDR.
      const issuedCode = ((json.card as Record<string, unknown>).code as string) ?? "";

      // Upload dos arquivos do step 6
      if (uploadedFiles.length > 0) {
        const failed: string[] = [];
        for (const file of uploadedFiles) {
          const form = new FormData();
          form.append("file", file);
          form.append("deal_id", dealId);
          form.append("doc_id", `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
          try {
            const upRes = await fetch("/api/ma/documents", { method: "POST", body: form });
            if (!upRes.ok) {
              const upJson = await upRes.json().catch(() => ({}));
              failed.push(`${file.name}: ${(upJson as Record<string,unknown>).error ?? upRes.status}`);
            }
          } catch {
            failed.push(`${file.name}: erro de rede`);
          }
        }
        if (failed.length > 0) {
          setError(`Deal criado, mas falha ao enviar ${failed.length} arquivo(s):\n${failed.join("\n")}`);
          setSaving(false);
          if (onSuccess) { onSuccess(dealId, issuedCode); }
          return;
        }
      }

      if (onSuccess) { onSuccess(dealId, issuedCode); return; }
      router.push("/mesa-ma");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar. Tente novamente.");
      setSaving(false);
    }
  }

  // ── Render Steps ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {

      case 1: return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldGroup label="Razão Social / Nome do Ativo *">
                <Input {...register("target_company")} placeholder="Ex: TechFinance Ltda" />
                {errors.target_company && <p className="text-xs text-red-400 mt-1">{errors.target_company.message}</p>}
              </FieldGroup>
            </div>

            <div className="md:col-span-2">
              <FieldGroup label="Tipo de Participante *">
                <div className="flex gap-3 mt-1">
                  {([
                    { value: "Vendedor", label: "Vendedor", desc: "Quero vender / captar investimento para meu ativo" },
                    { value: "Investidor", label: "Investidor", desc: "Estou buscando ativos para comprar / investir" },
                  ] as const).map(opt => {
                    const current = watch("tipo_participante");
                    return (
                      <label
                        key={opt.value}
                        className={`flex-1 flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          current === opt.value
                            ? "border-[#C9A84C] bg-[#C9A84C]/10"
                            : "border-[#243A66] bg-[#162744] hover:border-[#C9A84C]/40"
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          {...register("tipo_participante")}
                          className="hidden"
                        />
                        <span className={`text-sm font-bold ${current === opt.value ? "text-[#C9A84C]" : "text-[#F0ECE4]"}`}>{opt.label}</span>
                        <span className="text-[10px] text-[#7A8FA8] leading-relaxed">{opt.desc}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.tipo_participante && <p className="text-xs text-red-400 mt-1">{errors.tipo_participante.message}</p>}
              </FieldGroup>
            </div>

            <FieldGroup label="Setor *">
              <Select onValueChange={v => setValue("sector", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.sector && <p className="text-xs text-red-400 mt-1">{errors.sector.message}</p>}
            </FieldGroup>

            <FieldGroup label="Tipo de Transação *">
              <Select onValueChange={v => setValue("deal_type", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DEAL.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.deal_type && <p className="text-xs text-red-400 mt-1">{errors.deal_type.message}</p>}
            </FieldGroup>

            <FieldGroup label="Localização *">
              <Input {...register("location")} placeholder="Ex: São Paulo · SP" icon={<MapPin className="w-3.5 h-3.5" />} />
              {errors.location && <p className="text-xs text-red-400 mt-1">{errors.location.message}</p>}
            </FieldGroup>

            <FieldGroup label="CNPJ">
              <Input {...register("cnpj")} placeholder="00.000.000/0000-00" />
            </FieldGroup>

            <FieldGroup label="Ano de Fundação">
              <Input {...register("founding_year")} placeholder="Ex: 2018" />
            </FieldGroup>

            {/* Redes Sociais */}
            <div className="md:col-span-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-3 mt-1">
                Redes Sociais &amp; Presença Digital
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FieldGroup label="Instagram">
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C9A84C]" />
                    <input
                      {...register("instagram")}
                      placeholder="@empresa ou URL"
                      className="w-full h-9 rounded-lg border border-[#243A66] bg-[#162744] pl-9 pr-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition"
                    />
                  </div>
                </FieldGroup>
                <FieldGroup label="LinkedIn">
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C9A84C]" />
                    <input
                      {...register("linkedin")}
                      placeholder="linkedin.com/company/..."
                      className="w-full h-9 rounded-lg border border-[#243A66] bg-[#162744] pl-9 pr-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition"
                    />
                  </div>
                </FieldGroup>
                <FieldGroup label="Website">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C9A84C]" />
                    <input
                      {...register("website_url")}
                      placeholder="www.empresa.com.br"
                      className="w-full h-9 rounded-lg border border-[#243A66] bg-[#162744] pl-9 pr-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition"
                    />
                  </div>
                </FieldGroup>
              </div>
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-5">
          <FieldGroup label="Descrição do Negócio *">
            <Textarea
              {...register("descricao")}
              placeholder="Descreva o negócio, modelo de operação, posicionamento de mercado..."
              error={errors.descricao?.message}
              rows={4}
            />
          </FieldGroup>

          <FieldGroup label="Principais Produtos e Serviços *">
            <Textarea
              {...register("produtos_servicos")}
              placeholder="Liste os principais produtos e serviços oferecidos..."
              error={errors.produtos_servicos?.message}
              rows={3}
            />
          </FieldGroup>

          <FieldGroup label="Diferenciais Competitivos">
            <Textarea
              {...register("diferenciais")}
              placeholder="Um diferencial por linha. Ex:&#10;Tecnologia proprietária de análise de risco&#10;Margem EBITDA 44% acima da média do setor"
              rows={3}
            />
          </FieldGroup>

          <FieldGroup label="Mercado Atendido / Base de Clientes">
            <Textarea
              {...register("mercado_atendido")}
              placeholder="Descreva o mercado atendido, perfil de clientes, regiões..."
              rows={2}
            />
          </FieldGroup>
        </div>
      );

      case 3: return (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-3">Receita Bruta (R$)</p>
            <div className="grid grid-cols-3 gap-3">
              <MoneyInput label="2023" name="receita_2023" register={register} />
              <MoneyInput label="2024" name="receita_2024" register={register} />
              <MoneyInput label="2025" name="receita_2025" register={register} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-3">EBITDA (R$)</p>
            <div className="grid grid-cols-3 gap-3">
              <MoneyInput label="2023" name="ebitda_2023" register={register} />
              <MoneyInput label="2024" name="ebitda_2024" register={register} />
              <MoneyInput label="2025" name="ebitda_2025" register={register} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-3">Lucro Líquido (R$)</p>
            <div className="grid grid-cols-3 gap-3">
              <MoneyInput label="2023" name="lucro_2023" register={register} />
              <MoneyInput label="2024" name="lucro_2024" register={register} />
              <MoneyInput label="2025" name="lucro_2025" register={register} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#243A66]">
            <MoneyInput label="Dívida Total Atual (R$)" name="divida_total" register={register} />
            <div>
              <FieldGroup label="Valor Pretendido pelo Ativo (R$) *">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C9A84C]">R$</span>
                  <input
                    {...register("deal_value")}
                    placeholder="0,00"
                    className="w-full h-9 rounded-lg border border-[#243A66] bg-[#162744] pl-9 pr-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition"
                  />
                </div>
                {errors.deal_value && <p className="text-xs text-red-400 mt-1">{errors.deal_value.message}</p>}
              </FieldGroup>
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-5">
          <FieldGroup label="Licenças, Alvarás e Certificações">
            <Textarea
              {...register("licencas")}
              placeholder="Liste as principais licenças e certificações da empresa..."
              rows={3}
            />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#162744] border border-[#243A66] rounded-lg">
              <p className="text-xs font-semibold text-[#F0ECE4] mb-3">Processos Judiciais Ativos?</p>
              <div className="flex gap-3">
                {["nao", "sim"].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={v}
                      {...register("tem_processos")}
                      className="accent-[#C9A84C]"
                    />
                    <span className="text-sm text-[#F0ECE4]">{v === "sim" ? "Sim" : "Não"}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#162744] border border-[#243A66] rounded-lg">
              <p className="text-xs font-semibold text-[#F0ECE4] mb-3">Pendências Fiscais?</p>
              <div className="flex gap-3">
                {["nao", "sim"].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={v}
                      {...register("tem_pendencias")}
                      className="accent-[#C9A84C]"
                    />
                    <span className="text-sm text-[#F0ECE4]">{v === "sim" ? "Sim" : "Não"}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {temProcessos === "sim" && (
            <FieldGroup label="Detalhes dos Processos Judiciais">
              <Textarea
                {...register("detalhes_processos")}
                placeholder="Descreva os processos ativos, valores envolvidos e estágio processual..."
                rows={3}
              />
            </FieldGroup>
          )}

          <div className="flex items-start gap-3 p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A8FA8] leading-relaxed">
              As informações jurídicas serão validadas pela equipe de compliance (Robson Lino) antes da geração do CIM.
              Dados incorretos ou omitidos podem bloquear o processo.
            </p>
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldGroup label="Nome do Contato Principal *">
                <Input {...register("contato_nome")} placeholder="Nome completo" />
                {errors.contato_nome && <p className="text-xs text-red-400 mt-1">{errors.contato_nome.message}</p>}
              </FieldGroup>
            </div>

            <FieldGroup label="Email *">
              <Input {...register("contato_email")} type="email" placeholder="email@empresa.com.br" />
              {errors.contato_email && <p className="text-xs text-red-400 mt-1">{errors.contato_email.message}</p>}
            </FieldGroup>

            <FieldGroup label="Telefone / WhatsApp *">
              <Input {...register("contato_telefone")} placeholder="+55 11 99999-9999" />
              {errors.contato_telefone && <p className="text-xs text-red-400 mt-1">{errors.contato_telefone.message}</p>}
            </FieldGroup>

            <FieldGroup label="Comissionamento Acordado (%)">
              <div className="relative">
                <input
                  {...register("comissionamento")}
                  placeholder="Ex: 2,5"
                  className="w-full h-9 rounded-lg border border-[#243A66] bg-[#162744] pl-3 pr-8 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C9A84C]">%</span>
              </div>
            </FieldGroup>
          </div>

          <FieldGroup label="Informações Adicionais Relevantes">
            <Textarea
              {...register("info_adicionais")}
              placeholder="Qualquer informação adicional relevante para o processo de M&A..."
              rows={3}
            />
          </FieldGroup>

          {/* Resumo final */}
          <div className="p-4 bg-[#162744] border border-[#243A66] rounded-lg">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-3">Resumo do Cadastro</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                ["Ativo", watch("target_company")],
                ["Setor", watch("sector")],
                ["Tipo", watch("deal_type")],
                ["Localização", watch("location")],
                ["Valor Pretendido", watch("deal_value") ? `R$ ${watch("deal_value")}` : "—"],
                ["Processos", watch("tem_processos") === "sim" ? "Sim" : "Não"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[#7A8FA8]">{k}</dt>
                  <dd className="text-[#F0ECE4] font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      );

      case 6: return (
        <div className="space-y-5">
          {/* Tipos aceitos */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-2">Tipos de Documento</p>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_DOCUMENTO.map(t => (
                <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#162744] border border-[#243A66] text-[#7A8FA8]">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Zona de drop */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              isDragging
                ? "border-[#C9A84C] bg-[#C9A84C]/5"
                : "border-[#C9A84C]/30 bg-[#162744] hover:border-[#C9A84C]/60 hover:bg-[#C9A84C]/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#F0ECE4]">Arraste os documentos ou clique para selecionar</p>
              <p className="text-xs text-[#7A8FA8] mt-1">PDF, DOC, DOCX, XLS, XLSX, Imagens · Máx 10MB por arquivo · Máx {MAX_FILES} arquivos</p>
            </div>
          </div>

          {/* Erro de upload */}
          {uploadError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{uploadError}</p>
            </div>
          )}

          {/* Lista de arquivos */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C]">
                {uploadedFiles.length} arquivo{uploadedFiles.length > 1 ? "s" : ""} adicionado{uploadedFiles.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-1.5">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-[#162744] border border-[#243A66] rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                      <span className="text-xs text-[#F0ECE4] truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-[#7A8FA8]">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/20 text-[#7A8FA8] hover:text-red-400 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aviso IA */}
          <div className="flex items-start gap-3 p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A8FA8] leading-relaxed">
              Os documentos serão analisados pela IA para validação automática. Em modo demo, apenas os metadados são registrados.
            </p>
          </div>

          {uploadedFiles.length === 0 && (
            <p className="text-center text-xs text-[#7A8FA8]">
              O upload de documentos é opcional — você pode enviar o deal sem anexos.
            </p>
          )}
        </div>
      );
    }
  }

  // ── Layout principal ──────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl mx-auto">

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Conteúdo do step */}
      <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-6 mb-6 min-h-[380px]">
        <div className="flex items-center gap-2 mb-6">
          {(() => { const S = STEPS[step - 1]; return <S.icon className="w-4 h-4 text-[#C9A84C]" />; })()}
          <h2 className="text-sm font-bold text-[#F0ECE4] tracking-wide">
            {STEPS[step - 1].label}
          </h2>
          <span className="ml-auto text-[10px] text-[#7A8FA8] font-mono">{step} / {STEPS.length}</span>
        </div>

        {renderStep()}
      </div>

      {/* Erro global */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={step === 1 ? (onCancel ?? (() => router.push("/ma"))) : prevStep}
          className="border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4]"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 1 ? "Cancelar" : "Anterior"}
        </Button>

        {step < 6 ? (
          <Button
            type="button"
            onClick={nextStep}
            className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold"
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(
              onSubmit,
              (fieldErrors) => {
                const orderedSteps = [1, 2, 3, 4, 5] as const;
                const firstBad = orderedSteps.find(s =>
                  (STEP_FIELDS[s] as (keyof typeof fieldErrors)[]).some(f => fieldErrors[f])
                );
                if (firstBad !== undefined) setStep(firstBad);
                setError("Há campos obrigatórios incompletos. Verifique os dados antes de continuar.");
              }
            )()}
            className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold min-w-40"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Enviar para Mesa M&A</>
            )}
          </Button>
        )}
      </div>

      {isDemo && (
        <p className="text-center text-[10px] text-[#7A8FA8] mt-4">
          Modo demo — o cadastro não será salvo no banco
        </p>
      )}
    </form>
  );
}

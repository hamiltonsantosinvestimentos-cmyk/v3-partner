"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  FileText,
  TrendingUp,
  Scale,
  Users,
  Send,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  Package,
  Car,
  AlertCircle,
} from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  // Step 1
  segmento: z.enum(["commodities", "mobilidade"]),
  sub_segmento: z.string().min(1, "Selecione o tipo"),

  // Step 2 — Identificação
  titulo_ativo: z.string().min(5, "Mínimo 5 caracteres"),
  descricao: z.string().min(30, "Mínimo 30 caracteres"),
  localizacao: z.string().min(3, "Obrigatório"),

  // Commodities
  reserva_quantidade: z.string().optional(),
  unidade_medida: z.string().optional(),
  certificacao_orgao: z.string().optional(),
  numero_processo: z.string().optional(),
  area_hectares: z.string().optional(),

  // Mobilidade
  marca_modelo: z.string().optional(),
  ano_fabricacao: z.string().optional(),
  quantidade_unidades: z.string().optional(),
  estado_conservacao: z.enum(["novo", "seminovo", "bom", "regular"]).optional(),
  possui_documentacao: z.enum(["sim", "parcial", "nao"]).optional(),

  // Step 3 — Financeiro
  valor_pretendido: z.string().min(1, "Obrigatório"),
  valor_laudo: z.string().optional(),
  tipo_operacao: z.enum([
    "venda_total",
    "venda_parcial",
    "parceria",
    "joint_venture",
    "captacao",
  ]),
  exclusividade: z.enum(["sim", "nao"]),

  // Step 4 — Jurídico
  situacao_legal: z.enum([
    "regular",
    "pendencias_menores",
    "pendencias_relevantes",
  ]),
  tem_litigios: z.enum(["sim", "nao"]),
  documentacao_disponivel: z.array(z.string()),
  detalhes_juridicos: z.string().optional(),

  // Step 5 — Contato
  contato_nome: z.string().min(2, "Obrigatório"),
  contato_email: z.string().email("Email inválido"),
  contato_telefone: z.string().min(10, "Mínimo 10 dígitos"),
  relacao_ativo: z.enum([
    "proprietario",
    "representante",
    "corretor",
    "outro",
  ]),
  comissionamento: z.string().optional(),
  info_adicionais: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Constantes ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Segmento", icon: Layers },
  { id: 2, label: "Identificação", icon: FileText },
  { id: 3, label: "Financeiro", icon: TrendingUp },
  { id: 4, label: "Jurídico", icon: Scale },
  { id: 5, label: "Contato", icon: Users },
];

const SUB_COMMODITIES = [
  "Minério de Ferro",
  "Ouro",
  "Prata",
  "Lítio",
  "Esmeraldas e Pedras Preciosas",
  "Outro",
];

const SUB_MOBILIDADE = [
  "Automóveis",
  "Embarcações",
  "Aeronaves",
  "Frota Mista",
];

const DOCS_DISPONIVEIS = [
  "Escritura / Matrícula",
  "Laudo Técnico",
  "Certidão Regulatória (ANM/ANAC/etc.)",
  "Balanço Patrimonial",
  "Contrato Social",
  "Certidão Negativa",
  "Outro",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  const y = new Date().getFullYear().toString().slice(-2);
  const n = Math.floor(Math.random() * 900000) + 100000;
  return `PROS-${y}-3${n.toString().slice(0, 5)}`;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function FieldGroup({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-[#F0ECE4]">
        {label}
        {required && <span className="text-[#C9A84C] ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function TextareaField({
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div>
      <textarea
        {...props}
        className={`w-full min-h-[90px] rounded-lg border px-3 py-2 text-sm bg-[#162744] text-[#F0ECE4] placeholder:text-[#7A8FA8] resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition ${
          error ? "border-red-500/60" : "border-[#243A66]"
        } ${props.className ?? ""}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function MoneyInput({
  label,
  name,
  register,
  placeholder = "0,00",
  required,
}: {
  label: string;
  name: keyof FormData;
  register: ReturnType<typeof useForm<FormData>>["register"];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <FieldGroup label={label} required={required}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C9A84C]">
          R$
        </span>
        <input
          {...register(name)}
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
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done
                    ? "bg-[#C9A84C] border-[#C9A84C] text-[#09081A]"
                    : active
                    ? "bg-[#162744] border-[#C9A84C] text-[#C9A84C]"
                    : "bg-[#162744] border-[#243A66] text-[#7A8FA8]"
                }`}
              >
                {done ? <CheckCircle className="w-4 h-4" /> : step.id}
              </div>
              <span
                className={`text-[9px] font-semibold tracking-wide uppercase whitespace-nowrap ${
                  active
                    ? "text-[#C9A84C]"
                    : done
                    ? "text-[#C9A84C]/60"
                    : "text-[#7A8FA8]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 mx-1 mb-5 transition-all ${
                  done ? "bg-[#C9A84C]/50" : "bg-[#243A66]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
            value === opt.value
              ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#F0ECE4]"
              : "border-[#243A66] bg-[#162744] text-[#7A8FA8] hover:border-[#243A66]/80"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          <span
            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              value === opt.value
                ? "border-[#C9A84C]"
                : "border-[#7A8FA8]"
            }`}
          >
            {value === opt.value && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
            )}
          </span>
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

interface FormularioAtivoProps {
  isDemo: boolean;
  userId: string;
}

export function FormularioAtivo({ isDemo, userId }: FormularioAtivoProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [segmento, setSegmento] = useState<"commodities" | "mobilidade" | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentacao_disponivel: [],
      tem_litigios: "nao",
      exclusividade: "nao",
    },
  });

  const watchSegmento = watch("segmento");
  const watchSubSegmento = watch("sub_segmento");
  const watchSituacaoLegal = watch("situacao_legal");
  const watchTemLitigios = watch("tem_litigios");
  const watchExclusividade = watch("exclusividade");
  const watchDocumentacao = watch("documentacao_disponivel") ?? [];
  const watchRelacaoAtivo = watch("relacao_ativo");
  const watchTipoOperacao = watch("tipo_operacao");
  const watchPossuiDocumentacao = watch("possui_documentacao");
  const watchEstadoConservacao = watch("estado_conservacao");

  // Validação por step
  const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
    1: ["segmento", "sub_segmento"],
    2: ["titulo_ativo", "descricao", "localizacao"],
    3: ["valor_pretendido", "tipo_operacao", "exclusividade"],
    4: ["situacao_legal", "tem_litigios"],
    5: ["contato_nome", "contato_email", "contato_telefone", "relacao_ativo"],
  };

  async function nextStep() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, 5));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSegmentoSelect(seg: "commodities" | "mobilidade") {
    setSegmento(seg);
    setValue("segmento", seg);
    setValue("sub_segmento", "");
  }

  function toggleDoc(doc: string) {
    const current = watchDocumentacao;
    const updated = current.includes(doc)
      ? current.filter((d) => d !== doc)
      : [...current, doc];
    setValue("documentacao_disponivel", updated);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setGlobalError(null);

    const codigo = generateCode();

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1200));
      router.push(`/comunidade?novo=ativo&code=${codigo}`);
      return;
    }

    try {
      const res = await fetch("/api/comunidade/submeter-ativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: data, codigo }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao submeter");
      router.push(`/comunidade?novo=ativo&code=${codigo}`);
    } catch (e: unknown) {
      setGlobalError(
        e instanceof Error ? e.message : "Erro ao submeter. Tente novamente."
      );
      setSaving(false);
    }
  }

  // ── Render Steps ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── Step 1 — Segmento ────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-6">
            <p className="text-sm text-[#7A8FA8]">
              Selecione o segmento do ativo que deseja submeter.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Commodities */}
              <button
                type="button"
                onClick={() => handleSegmentoSelect("commodities")}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  segmento === "commodities"
                    ? "border-[#C9A84C] bg-[#C9A84C]/10"
                    : "border-[#243A66] bg-[#162744] hover:border-[#243A66]/80"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      segmento === "commodities"
                        ? "bg-[#C9A84C]/20"
                        : "bg-[#243A66]"
                    }`}
                  >
                    <Package
                      className={`w-5 h-5 ${
                        segmento === "commodities"
                          ? "text-[#C9A84C]"
                          : "text-[#7A8FA8]"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F0ECE4]">
                      Commodities
                    </p>
                    <p className="text-xs text-[#7A8FA8]">
                      Minério, metais preciosos, recursos naturais
                    </p>
                  </div>
                </div>

                {segmento === "commodities" && (
                  <div className="mt-3 space-y-2 border-t border-[#243A66] pt-3">
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-2">
                      Tipo de Commodity
                    </p>
                    {SUB_COMMODITIES.map((sub) => (
                      <label
                        key={sub}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="radio"
                          name="sub_segmento_comm"
                          value={sub}
                          checked={watchSubSegmento === sub}
                          onChange={() => setValue("sub_segmento", sub)}
                          className="sr-only"
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            watchSubSegmento === sub
                              ? "border-[#C9A84C]"
                              : "border-[#7A8FA8]"
                          }`}
                        >
                          {watchSubSegmento === sub && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                          )}
                        </span>
                        <span
                          className={`text-sm ${
                            watchSubSegmento === sub
                              ? "text-[#F0ECE4]"
                              : "text-[#7A8FA8]"
                          }`}
                        >
                          {sub}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </button>

              {/* Card Mobilidade */}
              <button
                type="button"
                onClick={() => handleSegmentoSelect("mobilidade")}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  segmento === "mobilidade"
                    ? "border-[#C9A84C] bg-[#C9A84C]/10"
                    : "border-[#243A66] bg-[#162744] hover:border-[#243A66]/80"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      segmento === "mobilidade"
                        ? "bg-[#C9A84C]/20"
                        : "bg-[#243A66]"
                    }`}
                  >
                    <Car
                      className={`w-5 h-5 ${
                        segmento === "mobilidade"
                          ? "text-[#C9A84C]"
                          : "text-[#7A8FA8]"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F0ECE4]">
                      Mobilidade
                    </p>
                    <p className="text-xs text-[#7A8FA8]">
                      Automóveis, embarcações, aeronaves
                    </p>
                  </div>
                </div>

                {segmento === "mobilidade" && (
                  <div className="mt-3 space-y-2 border-t border-[#243A66] pt-3">
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-2">
                      Tipo de Ativo
                    </p>
                    {SUB_MOBILIDADE.map((sub) => (
                      <label
                        key={sub}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="radio"
                          name="sub_segmento_mob"
                          value={sub}
                          checked={watchSubSegmento === sub}
                          onChange={() => setValue("sub_segmento", sub)}
                          className="sr-only"
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            watchSubSegmento === sub
                              ? "border-[#C9A84C]"
                              : "border-[#7A8FA8]"
                          }`}
                        >
                          {watchSubSegmento === sub && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                          )}
                        </span>
                        <span
                          className={`text-sm ${
                            watchSubSegmento === sub
                              ? "text-[#F0ECE4]"
                              : "text-[#7A8FA8]"
                          }`}
                        >
                          {sub}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </button>
            </div>

            {errors.segmento && (
              <p className="text-xs text-red-400">{errors.segmento.message}</p>
            )}
            {errors.sub_segmento && (
              <p className="text-xs text-red-400">
                {errors.sub_segmento.message}
              </p>
            )}
          </div>
        );

      // ── Step 2 — Identificação ───────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <FieldGroup label="Título do Ativo" required>
              <Input
                {...register("titulo_ativo")}
                placeholder={
                  watchSegmento === "commodities"
                    ? "Ex: Jazida de Esmeraldas — Nova Era/MG"
                    : "Ex: Frota Executiva — 3 Aeronaves Legacy 600"
                }
              />
              {errors.titulo_ativo && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.titulo_ativo.message}
                </p>
              )}
            </FieldGroup>

            <FieldGroup label="Descrição" required>
              <TextareaField
                {...register("descricao")}
                placeholder="Descreva o ativo com detalhes relevantes (min. 30 caracteres)"
                error={errors.descricao?.message}
              />
            </FieldGroup>

            <FieldGroup label="Localização" required>
              <Input
                {...register("localizacao")}
                placeholder="Ex: Nova Era · MG / São Paulo · SP"
              />
              {errors.localizacao && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.localizacao.message}
                </p>
              )}
            </FieldGroup>

            {/* Campos específicos Commodities */}
            {watchSegmento === "commodities" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Reserva / Quantidade">
                    <Input
                      {...register("reserva_quantidade")}
                      placeholder="Ex: 170 kg, 2,1 MT"
                    />
                  </FieldGroup>
                  <FieldGroup label="Unidade de Medida">
                    <Input
                      {...register("unidade_medida")}
                      placeholder="Ex: kg, toneladas, m³"
                    />
                  </FieldGroup>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Órgão Certificador">
                    <Input
                      {...register("certificacao_orgao")}
                      placeholder="Ex: ANM, DNPM, GIA"
                    />
                  </FieldGroup>
                  <FieldGroup label="Número do Processo Regulatório">
                    <Input
                      {...register("numero_processo")}
                      placeholder="Ex: 831.001/2022"
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Área (hectares)">
                  <Input
                    {...register("area_hectares")}
                    placeholder="Ex: 120,5"
                  />
                </FieldGroup>
              </>
            )}

            {/* Campos específicos Mobilidade */}
            {watchSegmento === "mobilidade" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Marca / Modelo">
                    <Input
                      {...register("marca_modelo")}
                      placeholder="Ex: Embraer Legacy 600"
                    />
                  </FieldGroup>
                  <FieldGroup label="Ano de Fabricação">
                    <Input
                      {...register("ano_fabricacao")}
                      placeholder="Ex: 2019"
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Quantidade de Unidades">
                  <Input
                    {...register("quantidade_unidades")}
                    placeholder="Ex: 3"
                  />
                </FieldGroup>

                <FieldGroup label="Estado de Conservação">
                  <Controller
                    control={control}
                    name="estado_conservacao"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="seminovo">Seminovo</SelectItem>
                          <SelectItem value="bom">Bom</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldGroup>

                <FieldGroup label="Documentação">
                  <RadioGroup
                    name="possui_documentacao"
                    value={watchPossuiDocumentacao}
                    onChange={(v) =>
                      setValue(
                        "possui_documentacao",
                        v as FormData["possui_documentacao"]
                      )
                    }
                    options={[
                      { value: "sim", label: "Completa" },
                      { value: "parcial", label: "Parcial" },
                      { value: "nao", label: "Sem documentação" },
                    ]}
                  />
                </FieldGroup>
              </>
            )}
          </div>
        );

      // ── Step 3 — Financeiro ──────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyInput
                label="Valor Pretendido"
                name="valor_pretendido"
                register={register}
                placeholder="Ex: 4.500.000,00"
                required
              />
              {errors.valor_pretendido && (
                <p className="text-xs text-red-400 mt-1 col-span-2">
                  {errors.valor_pretendido.message}
                </p>
              )}
              <MoneyInput
                label="Valor do Laudo (se houver)"
                name="valor_laudo"
                register={register}
                placeholder="Opcional"
              />
            </div>

            <FieldGroup label="Tipo de Operação" required>
              <Controller
                control={control}
                name="tipo_operacao"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venda_total">Venda Total</SelectItem>
                      <SelectItem value="venda_parcial">Venda Parcial</SelectItem>
                      <SelectItem value="parceria">Parceria Operacional</SelectItem>
                      <SelectItem value="joint_venture">Joint Venture</SelectItem>
                      <SelectItem value="captacao">Captação de Capital</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo_operacao && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.tipo_operacao.message}
                </p>
              )}
            </FieldGroup>

            <FieldGroup label="Aceita exclusividade V3?" required>
              <RadioGroup
                name="exclusividade"
                value={watchExclusividade}
                onChange={(v) =>
                  setValue("exclusividade", v as FormData["exclusividade"], { shouldValidate: true })
                }
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                ]}
              />
              <p className="text-xs text-[#7A8FA8] mt-1">
                Exclusividade por 180 dias após assinatura do Mandato
              </p>
              {errors.exclusividade && (
                <p className="text-xs text-red-400">
                  {errors.exclusividade.message}
                </p>
              )}
            </FieldGroup>
          </div>
        );

      // ── Step 4 — Jurídico ────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-5">
            <FieldGroup label="Situação Legal" required>
              <Controller
                control={control}
                name="situacao_legal"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Totalmente Regular</SelectItem>
                      <SelectItem value="pendencias_menores">
                        Pendências Menores
                      </SelectItem>
                      <SelectItem value="pendencias_relevantes">
                        Pendências Relevantes
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.situacao_legal && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.situacao_legal.message}
                </p>
              )}
            </FieldGroup>

            <FieldGroup label="Há litígios ativos?" required>
              <RadioGroup
                name="tem_litigios"
                value={watchTemLitigios}
                onChange={(v) =>
                  setValue("tem_litigios", v as FormData["tem_litigios"], { shouldValidate: true })
                }
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                ]}
              />
            </FieldGroup>

            <FieldGroup label="Documentação Disponível">
              <div className="grid grid-cols-1 gap-2">
                {DOCS_DISPONIVEIS.map((doc) => (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => toggleDoc(doc)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer text-sm transition-all text-left ${
                      watchDocumentacao.includes(doc)
                        ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#F0ECE4]"
                        : "border-[#243A66] bg-[#162744] text-[#7A8FA8]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        watchDocumentacao.includes(doc)
                          ? "border-[#C9A84C] bg-[#C9A84C]"
                          : "border-[#7A8FA8]"
                      }`}
                    >
                      {watchDocumentacao.includes(doc) && (
                        <CheckCircle className="w-3 h-3 text-[#09081A]" />
                      )}
                    </div>
                    <span>{doc}</span>
                  </button>
                ))}
              </div>
            </FieldGroup>

            {(watchSituacaoLegal === "pendencias_menores" ||
              watchSituacaoLegal === "pendencias_relevantes") && (
              <FieldGroup label="Detalhes das Pendências">
                <TextareaField
                  {...register("detalhes_juridicos")}
                  placeholder="Descreva as pendências jurídicas relevantes"
                  error={errors.detalhes_juridicos?.message}
                />
              </FieldGroup>
            )}

            <div className="flex items-start gap-3 p-4 rounded-xl border border-[#243A66] bg-[#162744]">
              <AlertCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#7A8FA8]">
                Informações jurídicas validadas pelo compliance V3 (Robson Lino)
                antes de qualquer divulgação.
              </p>
            </div>
          </div>
        );

      // ── Step 5 — Contato + Resumo ────────────────────────────────────────
      case 5:
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FieldGroup label="Nome do Proprietário / Representante" required>
                  <Input
                    {...register("contato_nome")}
                    placeholder="Nome completo"
                  />
                  {errors.contato_nome && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.contato_nome.message}
                    </p>
                  )}
                </FieldGroup>
              </div>

              <FieldGroup label="Email" required>
                <Input
                  {...register("contato_email")}
                  type="email"
                  placeholder="email@exemplo.com"
                />
                {errors.contato_email && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.contato_email.message}
                  </p>
                )}
              </FieldGroup>

              <FieldGroup label="Telefone / WhatsApp" required>
                <Input
                  {...register("contato_telefone")}
                  placeholder="(21) 98000-0000"
                />
                {errors.contato_telefone && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.contato_telefone.message}
                  </p>
                )}
              </FieldGroup>
            </div>

            <FieldGroup label="Relação com o Ativo" required>
              <Controller
                control={control}
                name="relacao_ativo"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprietario">
                        Proprietário Direto
                      </SelectItem>
                      <SelectItem value="representante">
                        Representante Legal
                      </SelectItem>
                      <SelectItem value="corretor">
                        Corretor / Intermediário
                      </SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.relacao_ativo && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.relacao_ativo.message}
                </p>
              )}
            </FieldGroup>

            <FieldGroup label="Comissionamento esperado (%)">
              <Input
                {...register("comissionamento")}
                placeholder="Ex: 2,5%"
              />
            </FieldGroup>

            <FieldGroup label="Informações Adicionais">
              <TextareaField
                {...register("info_adicionais")}
                placeholder="Qualquer informação relevante não coberta acima"
              />
            </FieldGroup>

            {/* Card Resumo */}
            <div className="rounded-xl border border-[#243A66] bg-[#162744] p-5 space-y-3">
              <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]">
                Resumo do Ativo
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-[#7A8FA8]">Segmento</span>
                  <p className="text-[#F0ECE4] font-medium capitalize">
                    {watchSegmento ?? "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[#7A8FA8]">Sub-segmento</span>
                  <p className="text-[#F0ECE4] font-medium">
                    {watch("sub_segmento") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[#7A8FA8]">Título</span>
                  <p className="text-[#F0ECE4] font-medium">
                    {watch("titulo_ativo") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[#7A8FA8]">Localização</span>
                  <p className="text-[#F0ECE4] font-medium">
                    {watch("localizacao") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[#7A8FA8]">Valor Pretendido</span>
                  <p className="text-[#F0ECE4] font-medium">
                    R$ {watch("valor_pretendido") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[#7A8FA8]">Tipo de Operação</span>
                  <p className="text-[#F0ECE4] font-medium capitalize">
                    {watch("tipo_operacao")?.replace(/_/g, " ") || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-[#111F35] rounded-2xl border border-[#243A66] p-6 md:p-8"
    >
      <StepIndicator current={step} />

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {(() => {
            const Icon = STEPS[step - 1].icon;
            return <Icon className="w-4 h-4 text-[#C9A84C]" />;
          })()}
          <h2 className="text-lg font-semibold text-[#F0ECE4]">
            {STEPS[step - 1].label}
          </h2>
        </div>
        <div className="h-px bg-[#243A66]" />
      </div>

      {renderStep()}

      {globalError && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {globalError}
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#243A66]">
        <Button
          type="button"
          variant="ghost"
          onClick={prevStep}
          disabled={step === 1}
          className="text-[#7A8FA8] hover:text-[#F0ECE4] disabled:opacity-0"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>

        {step < 5 ? (
          <Button
            type="button"
            onClick={nextStep}
            disabled={step === 1 && (!segmento || !watchSubSegmento)}
            className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold"
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submeter Ativo para Análise
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

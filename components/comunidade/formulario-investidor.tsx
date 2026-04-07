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
  User,
  Target,
  DollarSign,
  Phone,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  // Step 1 — Perfil
  tipo_investidor: z.enum(["pessoa_fisica", "pessoa_juridica", "fundo", "family_office"]),
  nome_completo: z.string().min(3, "Mínimo 3 caracteres"),
  empresa: z.string().optional(),
  pais_origem: z.string().min(2, "Informe o país de origem"),
  ja_investiu_ma: z.enum(["sim", "nao"]),

  // Step 2 — Interesse
  segmentos: z.array(z.string()).min(1, "Selecione ao menos 1 segmento"),
  tipo_operacao: z.enum([
    "aquisicao_total",
    "aquisicao_parcial",
    "parceria",
    "joint_venture",
    "financiamento",
  ]),
  prazo_decisao: z.enum(["30_dias", "60_dias", "90_dias", "6_meses", "sem_pressa"]),
  regioes_interesse: z.string().min(2, "Informe ao menos uma região"),

  // Step 3 — Capacidade Financeira
  ticket_min: z.string().min(1, "Obrigatório"),
  ticket_max: z.string().min(1, "Obrigatório"),
  retorno_esperado: z.enum(["ate_15", "15_25", "25_40", "acima_40"]),
  fonte_recursos: z.enum(["proprio", "fundo", "financiamento", "misto"]),
  pode_assinar_nda: z.enum(["sim", "nao"]),

  // Step 4 — Contato
  contato_nome: z.string().min(2, "Mínimo 2 caracteres"),
  contato_email: z.string().email("Email inválido"),
  contato_telefone: z.string().min(10, "Mínimo 10 dígitos"),
  como_conheceu: z.string().optional(),
  info_adicionais: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Constantes ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Perfil",     icon: User       },
  { id: 2, label: "Interesse",  icon: Target      },
  { id: 3, label: "Capacidade", icon: DollarSign  },
  { id: 4, label: "Contato",    icon: Phone       },
];

const SEGMENTOS = [
  { value: "commodities_minerio",  label: "Commodities — Minério",         emoji: "🪨" },
  { value: "commodities_metais",   label: "Commodities — Metais Preciosos", emoji: "🥇" },
  { value: "mobilidade_automoveis",label: "Mobilidade — Automóveis",        emoji: "🚗" },
  { value: "mobilidade_embarcacoes",label:"Mobilidade — Embarcações",       emoji: "⛵" },
  { value: "mobilidade_aeronaves", label: "Mobilidade — Aeronaves",         emoji: "✈️" },
];

const TIPOS_OPERACAO = [
  { value: "aquisicao_total",    label: "Aquisição Total (100%)" },
  { value: "aquisicao_parcial",  label: "Aquisição Parcial" },
  { value: "parceria",           label: "Parceria Estratégica" },
  { value: "joint_venture",      label: "Joint Venture" },
  { value: "financiamento",      label: "Financiamento Estruturado" },
];

const PRAZOS = [
  { value: "30_dias",    label: "Até 30 dias" },
  { value: "60_dias",    label: "Até 60 dias" },
  { value: "90_dias",    label: "Até 90 dias" },
  { value: "6_meses",    label: "Até 6 meses" },
  { value: "sem_pressa", label: "Sem pressa definida" },
];

const RETORNOS = [
  { value: "ate_15",   label: "Até 15% a.a." },
  { value: "15_25",    label: "15–25% a.a." },
  { value: "25_40",    label: "25–40% a.a." },
  { value: "acima_40", label: "Acima de 40% a.a." },
];

const FONTES_RECURSOS = [
  { value: "proprio",      label: "Capital Próprio" },
  { value: "fundo",        label: "Fundo de Investimento" },
  { value: "financiamento",label: "Via Financiamento" },
  { value: "misto",        label: "Misto" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateProspectCode(tipo: "ativo" | "investidor"): string {
  const y = new Date().getFullYear().toString().slice(-2);
  const prefix = tipo === "investidor" ? "4" : "3";
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `PROS-${y}-${prefix}${n}`;
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

function StyledTextarea({
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div>
      <textarea
        {...props}
        className={`w-full min-h-[80px] rounded-lg border px-3 py-2 text-sm bg-[#162744] text-[#F0ECE4] placeholder:text-[#7A8FA8] resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition ${
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
  error,
}: {
  label: string;
  name: string;
  register: ReturnType<typeof useForm<FormData>>["register"];
  placeholder?: string;
  error?: string;
}) {
  return (
    <FieldGroup label={label}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C9A84C]">R$</span>
        <input
          {...register(name as keyof FormData)}
          placeholder={placeholder}
          className={`w-full h-9 rounded-lg border bg-[#162744] pl-9 pr-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition ${
            error ? "border-red-500/60" : "border-[#243A66]"
          }`}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
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
                  active ? "text-[#C9A84C]" : done ? "text-[#C9A84C]/60" : "text-[#7A8FA8]"
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

// ── Formulário Principal ──────────────────────────────────────────────────────

interface FormularioInvestidorProps {
  isDemo: boolean;
  userId: string;
}

export function FormularioInvestidor({ isDemo, userId: _userId }: FormularioInvestidorProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      ja_investiu_ma: "nao",
      pode_assinar_nda: "sim",
      segmentos: [],
    },
  });

  const segmentosSelecionados = watch("segmentos") ?? [];

  // ── Validação por step ──
  const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
    1: ["tipo_investidor", "nome_completo", "pais_origem", "ja_investiu_ma"],
    2: ["segmentos", "tipo_operacao", "prazo_decisao", "regioes_interesse"],
    3: ["ticket_min", "ticket_max", "retorno_esperado", "fonte_recursos", "pode_assinar_nda"],
    4: ["contato_nome", "contato_email", "contato_telefone"],
  };

  async function nextStep() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep(s => Math.min(s + 1, 4));
  }

  function prevStep() {
    setStep(s => Math.max(s - 1, 1));
  }

  function toggleSegmento(value: string) {
    const atual = watch("segmentos") ?? [];
    if (atual.includes(value)) {
      setValue("segmentos", atual.filter(v => v !== value), { shouldValidate: true });
    } else {
      setValue("segmentos", [...atual, value], { shouldValidate: true });
    }
  }

  // ── Submit ──
  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);

    const codigo = generateProspectCode("investidor");

    if (isDemo) {
      await new Promise(r => setTimeout(r, 1200));
      router.push(`/comunidade?novo=investidor&code=${codigo}`);
      return;
    }

    try {
      const res = await fetch("/api/comunidade/submeter-investidor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: data, codigo }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Erro ao enviar. Tente novamente.");
      }

      router.push(`/comunidade?novo=investidor&code=${codigo}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar. Tente novamente.");
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
              <FieldGroup label="Tipo de Investidor *">
                <Controller
                  control={control}
                  name="tipo_investidor"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                        <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
                        <SelectItem value="fundo">Fundo de Investimento</SelectItem>
                        <SelectItem value="family_office">Family Office</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.tipo_investidor && (
                  <p className="text-xs text-red-400 mt-1">{errors.tipo_investidor.message}</p>
                )}
              </FieldGroup>
            </div>

            <div className="md:col-span-2">
              <FieldGroup label="Nome Completo / Razão Social *">
                <Input {...register("nome_completo")} placeholder="Ex: João Lemos Netto ou V3 Partners Soluções Ltda" />
                {errors.nome_completo && (
                  <p className="text-xs text-red-400 mt-1">{errors.nome_completo.message}</p>
                )}
              </FieldGroup>
            </div>

            <FieldGroup label="Empresa (opcional)">
              <Input {...register("empresa")} placeholder="Nome da empresa ou fundo" />
            </FieldGroup>

            <FieldGroup label="País de Origem *">
              <Input {...register("pais_origem")} placeholder="Ex: Brasil" />
              {errors.pais_origem && (
                <p className="text-xs text-red-400 mt-1">{errors.pais_origem.message}</p>
              )}
            </FieldGroup>

            <div className="md:col-span-2">
              <div className="p-4 bg-[#162744] border border-[#243A66] rounded-lg">
                <p className="text-xs font-semibold text-[#F0ECE4] mb-3">Já investiu em M&A antes? *</p>
                <div className="flex gap-4">
                  {["nao", "sim"].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={v}
                        {...register("ja_investiu_ma")}
                        className="accent-[#C9A84C]"
                      />
                      <span className="text-sm text-[#F0ECE4]">{v === "sim" ? "Sim" : "Não"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-5">

          <div>
            <p className="text-xs font-semibold text-[#F0ECE4] mb-3">
              Segmentos de Interesse *
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {SEGMENTOS.map(seg => {
                const selecionado = segmentosSelecionados.includes(seg.value);
                return (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => toggleSegmento(seg.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      selecionado
                        ? "border-[#C9A84C] bg-[#C9A84C]/10"
                        : "border-[#243A66] bg-[#162744] hover:border-[#C9A84C]/50"
                    }`}
                  >
                    <span className="text-xl leading-none">{seg.emoji}</span>
                    <span
                      className={`text-xs font-semibold leading-snug ${
                        selecionado ? "text-[#F0ECE4]" : "text-[#7A8FA8]"
                      }`}
                    >
                      {seg.label}
                    </span>
                    {selecionado && (
                      <CheckCircle className="w-4 h-4 text-[#C9A84C] ml-auto flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            {errors.segmentos && (
              <p className="text-xs text-red-400 mt-2">{errors.segmentos.message}</p>
            )}
          </div>

          <FieldGroup label="Tipo de Operação *">
            <Controller
              control={control}
              name="tipo_operacao"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de operação" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_OPERACAO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.tipo_operacao && (
              <p className="text-xs text-red-400 mt-1">{errors.tipo_operacao.message}</p>
            )}
          </FieldGroup>

          <FieldGroup label="Prazo para Decisão *">
            <Controller
              control={control}
              name="prazo_decisao"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o prazo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRAZOS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.prazo_decisao && (
              <p className="text-xs text-red-400 mt-1">{errors.prazo_decisao.message}</p>
            )}
          </FieldGroup>

          <FieldGroup label="Regiões de Interesse *">
            <Input
              {...register("regioes_interesse")}
              placeholder="Ex: Brasil, Portugal, Angola"
            />
            {errors.regioes_interesse && (
              <p className="text-xs text-red-400 mt-1">{errors.regioes_interesse.message}</p>
            )}
          </FieldGroup>

        </div>
      );

      case 3: return (
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <MoneyInput
              label="Ticket Mínimo (R$) *"
              name="ticket_min"
              register={register}
              error={errors.ticket_min?.message}
            />
            <MoneyInput
              label="Ticket Máximo (R$) *"
              name="ticket_max"
              register={register}
              error={errors.ticket_max?.message}
            />
          </div>

          <FieldGroup label="Retorno Esperado *">
            <Controller
              control={control}
              name="retorno_esperado"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a faixa de retorno" />
                  </SelectTrigger>
                  <SelectContent>
                    {RETORNOS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.retorno_esperado && (
              <p className="text-xs text-red-400 mt-1">{errors.retorno_esperado.message}</p>
            )}
          </FieldGroup>

          <FieldGroup label="Fonte dos Recursos *">
            <Controller
              control={control}
              name="fonte_recursos"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTES_RECURSOS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.fonte_recursos && (
              <p className="text-xs text-red-400 mt-1">{errors.fonte_recursos.message}</p>
            )}
          </FieldGroup>

          <div className="p-4 bg-[#162744] border border-[#243A66] rounded-lg">
            <p className="text-xs font-semibold text-[#F0ECE4] mb-3">Pode assinar NDA digital? *</p>
            <div className="flex gap-4">
              {["sim", "nao"].map(v => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={v}
                    {...register("pode_assinar_nda")}
                    className="accent-[#C9A84C]"
                  />
                  <span className="text-sm text-[#F0ECE4]">{v === "sim" ? "Sim" : "Não"}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A8FA8] leading-relaxed">
              Suas informações são tratadas com absoluta confidencialidade. Acesso restrito à equipe V3.
            </p>
          </div>

        </div>
      );

      case 4: return (
        <div className="space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="md:col-span-2">
              <FieldGroup label="Nome do Responsável pelo Contato *">
                <Input {...register("contato_nome")} placeholder="Nome completo" />
                {errors.contato_nome && (
                  <p className="text-xs text-red-400 mt-1">{errors.contato_nome.message}</p>
                )}
              </FieldGroup>
            </div>

            <FieldGroup label="Email *">
              <Input {...register("contato_email")} type="email" placeholder="email@empresa.com.br" />
              {errors.contato_email && (
                <p className="text-xs text-red-400 mt-1">{errors.contato_email.message}</p>
              )}
            </FieldGroup>

            <FieldGroup label="Telefone / WhatsApp *">
              <Input {...register("contato_telefone")} placeholder="+55 21 99999-9999" />
              {errors.contato_telefone && (
                <p className="text-xs text-red-400 mt-1">{errors.contato_telefone.message}</p>
              )}
            </FieldGroup>

            <div className="md:col-span-2">
              <FieldGroup label="Como conheceu a V3 Partners? (opcional)">
                <Input {...register("como_conheceu")} placeholder="Ex: Indicação, LinkedIn, evento..." />
              </FieldGroup>
            </div>

            <div className="md:col-span-2">
              <FieldGroup label="Informações Adicionais (opcional)">
                <StyledTextarea
                  {...register("info_adicionais")}
                  placeholder="Contexto adicional sobre seu perfil, mandato de investimento ou operações de interesse..."
                  rows={3}
                />
              </FieldGroup>
            </div>

          </div>

          {/* Card de resumo */}
          <div className="p-4 bg-[#162744] border border-[#243A66] rounded-xl">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-4">
              Resumo do Perfil
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              {[
                ["Tipo", { pessoa_fisica: "Pessoa Física", pessoa_juridica: "Pessoa Jurídica", fundo: "Fundo de Investimento", family_office: "Family Office" }[watch("tipo_investidor")] ?? "—"],
                ["Nome / Razão Social", watch("nome_completo")],
                ["País", watch("pais_origem")],
                ["Segmentos", segmentosSelecionados.length > 0
                  ? segmentosSelecionados.map(v => SEGMENTOS.find(s => s.value === v)?.emoji + " " + (SEGMENTOS.find(s => s.value === v)?.label ?? v)).join(", ")
                  : "—"],
                ["Ticket Mín.", watch("ticket_min") ? `R$ ${watch("ticket_min")}` : "—"],
                ["Ticket Máx.", watch("ticket_max") ? `R$ ${watch("ticket_max")}` : "—"],
                ["Retorno esperado", { ate_15: "Até 15% a.a.", "15_25": "15–25% a.a.", "25_40": "25–40% a.a.", acima_40: "Acima de 40% a.a." }[watch("retorno_esperado")] ?? "—"],
                ["NDA digital", watch("pode_assinar_nda") === "sim" ? "Sim" : "Não"],
              ].map(([k, v]) => (
                <div key={k as string} className={typeof v === "string" && v.length > 30 ? "col-span-2" : ""}>
                  <dt className="text-[#7A8FA8] mb-0.5">{k}</dt>
                  <dd className="text-[#F0ECE4] font-medium leading-snug">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

        </div>
      );

      default: return null;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 md:p-8">
      <StepIndicator current={step} />

      {/* Step Header */}
      <div className="mb-6">
        {(() => {
          const s = STEPS[step - 1];
          const Icon = s.icon;
          return (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#09081A]" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C]">
                  Etapa {step} de {STEPS.length}
                </p>
                <h2 className="text-base font-semibold text-[#F0ECE4]">{s.label}</h2>
              </div>
            </div>
          );
        })()}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step Content */}
        <div className="min-h-[320px]">{renderStep()}</div>

        {/* Error global */}
        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#243A66]">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1 || saving}
            className="gap-2 text-[#7A8FA8] hover:text-[#F0ECE4]"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>

          {step < 4 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={saving}
              className="gap-2 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold"
            >
              Próxima etapa
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={saving}
              className="gap-2 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold min-w-[200px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Perfil de Investidor
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

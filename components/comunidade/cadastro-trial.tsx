"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
  UserPlus,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  telefone: z.string().min(10, "Mínimo 10 dígitos"),
  cpf_cnpj: z.string().min(11, "CPF ou CNPJ obrigatório"),
  tipo_pessoa: z.enum(["fisica", "juridica"]),
  pais_residencia: z.string().optional(),
  intencao: z.enum(["submeter", "buscar", "ambos"]),
  aceite_termos: z.boolean().refine((v) => v === true, {
    message: "Aceite os Termos de Uso para continuar",
  }),
  aceite_lgpd: z.boolean().refine((v) => v === true, {
    message: "Autorize o tratamento de dados (LGPD) para continuar",
  }),
});

type FormData = z.infer<typeof schema>;

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

function CheckboxField({
  label,
  checked,
  onChange,
  error,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            checked
              ? "border-[#C9A84C] bg-[#C9A84C]"
              : "border-[#7A8FA8] bg-transparent"
          }`}
        >
          {checked && <CheckCircle className="w-3 h-3 text-[#09081A]" />}
        </button>
        <span className="text-xs text-[#7A8FA8] leading-relaxed">{label}</span>
      </label>
      {error && <p className="text-xs text-red-400 mt-1 ml-7">{error}</p>}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function CadastroTrial() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [codigoTrial, setCodigoTrial] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_pessoa: "fisica",
      aceite_termos: false,
      aceite_lgpd: false,
    },
  });

  const watchTipoPessoa = watch("tipo_pessoa");
  const watchIntencao = watch("intencao");
  const watchAceiteTermos = watch("aceite_termos");
  const watchAceiteLGPD = watch("aceite_lgpd");

  async function goToStep2() {
    const valid = await trigger([
      "nome",
      "email",
      "telefone",
      "cpf_cnpj",
      "tipo_pessoa",
      "intencao",
      "aceite_termos",
      "aceite_lgpd",
    ]);
    if (valid) setStep(2);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setGlobalError(null);

    try {
      await new Promise((r) => setTimeout(r, 1500));
      const y = new Date().getFullYear().toString().slice(-2);
      const n = Math.floor(Math.random() * 90000) + 10000;
      const codigo = `TRIAL-${y}-${n}`;
      setCodigoTrial(codigo);
    } catch (e: unknown) {
      setGlobalError(
        e instanceof Error ? e.message : "Erro ao criar conta. Tente novamente."
      );
      setSaving(false);
    }
  }

  // Tela de sucesso
  if (codigoTrial) {
    return (
      <div className="bg-[#111F35] rounded-2xl border border-[#243A66] p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-[#C9A84C]" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#F0ECE4] mb-1">
            Cadastro realizado!
          </h2>
          <p className="text-sm text-[#7A8FA8]">
            Enviamos um email de confirmação. Verifique sua caixa de entrada.
          </p>
        </div>

        <div className="bg-[#162744] rounded-xl border border-[#243A66] p-4">
          <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-1">
            Código de Acesso
          </p>
          <p className="text-lg font-bold text-[#F0ECE4] tracking-wider">
            {codigoTrial}
          </p>
        </div>

        <Button
          onClick={() => router.push("/comunidade")}
          className="w-full bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold"
        >
          Acessar Comunidade
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-[#111F35] rounded-2xl border border-[#243A66] p-6 md:p-8">
      {/* Step indicator simples */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  step > s
                    ? "bg-[#C9A84C] border-[#C9A84C] text-[#09081A]"
                    : step === s
                    ? "bg-[#162744] border-[#C9A84C] text-[#C9A84C]"
                    : "bg-[#162744] border-[#243A66] text-[#7A8FA8]"
                }`}
              >
                {step > s ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              <span
                className={`text-[9px] font-semibold tracking-wide uppercase ${
                  step === s
                    ? "text-[#C9A84C]"
                    : step > s
                    ? "text-[#C9A84C]/60"
                    : "text-[#7A8FA8]"
                }`}
              >
                {s === 1 ? "Dados" : "Confirmação"}
              </span>
            </div>
            {i < 1 && (
              <div
                className={`h-px w-12 mb-5 transition-all ${
                  step > s ? "bg-[#C9A84C]/50" : "bg-[#243A66]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ── Step 1 — Dados Pessoais ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <FieldGroup label="Nome Completo" required>
              <Input {...register("nome")} placeholder="Seu nome completo" />
              {errors.nome && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.nome.message}
                </p>
              )}
            </FieldGroup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldGroup label="Email" required>
                <Input
                  {...register("email")}
                  type="email"
                  placeholder="email@exemplo.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.email.message}
                  </p>
                )}
              </FieldGroup>

              <FieldGroup label="Telefone / WhatsApp" required>
                <Input
                  {...register("telefone")}
                  placeholder="(21) 98000-0000"
                />
                {errors.telefone && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.telefone.message}
                  </p>
                )}
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldGroup label="CPF ou CNPJ" required>
                <Input
                  {...register("cpf_cnpj")}
                  placeholder="000.000.000-00"
                />
                {errors.cpf_cnpj && (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.cpf_cnpj.message}
                  </p>
                )}
              </FieldGroup>

              <FieldGroup label="Tipo de Pessoa" required>
                <Select
                  defaultValue="fisica"
                  onValueChange={(v) =>
                    setValue("tipo_pessoa", v as FormData["tipo_pessoa"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Pessoa Física</SelectItem>
                    <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
            </div>

            <FieldGroup label="País de Residência">
              <Input
                {...register("pais_residencia")}
                placeholder="Ex: Brasil"
              />
            </FieldGroup>

            <FieldGroup label="Como pretende usar a plataforma?" required>
              <Select
                onValueChange={(v) =>
                  setValue("intencao", v as FormData["intencao"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submeter">Submeter um ativo</SelectItem>
                  <SelectItem value="buscar">
                    Buscar ativos para investir
                  </SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
              {errors.intencao && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.intencao.message}
                </p>
              )}
            </FieldGroup>

            <div className="pt-2 space-y-3">
              <CheckboxField
                label={
                  <>
                    Declaro que as informações fornecidas são verdadeiras e
                    aceito os{" "}
                    <span className="text-[#C9A84C] underline cursor-pointer">
                      Termos de Uso
                    </span>
                  </>
                }
                checked={watchAceiteTermos}
                onChange={(v) => setValue("aceite_termos", v)}
                error={errors.aceite_termos?.message}
              />
              <CheckboxField
                label="Autorizo o tratamento dos meus dados conforme a LGPD"
                checked={watchAceiteLGPD}
                onChange={(v) => setValue("aceite_lgpd", v)}
                error={errors.aceite_lgpd?.message}
              />
            </div>

            <div className="pt-4">
              <Button
                type="button"
                onClick={goToStep2}
                className="w-full bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold"
              >
                Continuar
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2 — Confirmação ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-3">
                Trial de 30 dias — O que está incluso
              </p>

              <div className="bg-[#162744] rounded-xl border border-[#243A66] p-5 space-y-3">
                {[
                  { ok: true, label: "Acesso à Comunidade de Negócios" },
                  {
                    ok: true,
                    label: "Submissão de 1 ativo ou perfil de investidor",
                  },
                  { ok: true, label: "Análise preliminar pela equipe V3" },
                  {
                    ok: true,
                    label: "Relatório de inteligência de mercado semanal",
                  },
                  { ok: false, label: "Sem acesso à Mesa M&A interna" },
                  { ok: false, label: "Sem geração de criativos" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.ok ? (
                      <CheckCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#7A8FA8] flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        item.ok ? "text-[#F0ECE4]" : "text-[#7A8FA8]"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5">
              <AlertCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#7A8FA8]">
                Após o período trial, converta para{" "}
                <span className="text-[#C9A84C] font-semibold">
                  V3 Partner (R$497/mês)
                </span>{" "}
                ou{" "}
                <span className="text-[#C9A84C] font-semibold">
                  V3 Partner PRO (R$897/mês)
                </span>{" "}
                para acesso completo à plataforma.
              </p>
            </div>

            {globalError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {globalError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-[#7A8FA8] hover:text-[#F0ECE4]"
              >
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar Conta Trial Gratuita
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

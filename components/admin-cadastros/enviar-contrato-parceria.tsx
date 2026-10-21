"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSignature, Loader2, Send, CheckCircle2, AlertTriangle, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CAMPOS_LICENCIADO, PLANO_LABEL, camposFaltantes, dadosDoCadastro, pickContratoParceriaTemplate,
  type CadastroParaContrato, type DadosLicenciado, type ParceriaTemplate, type PlanoContratoParceria,
} from "@/lib/contrato-parceria-partner";

// Botão "Enviar contrato" do cadastro aprovado (21/10/2026, pedido do
// Hamilton): gera o Contrato de Parceria v2.2 com os dados do cadastro, envia
// para assinatura no ClickSign e o contrato fica na Central de Contratos.

type Contrato = {
  id: string;
  contract_code: string | null;
  status_signature: string;
  created_at: string;
  sent_to_signature_at: string | null;
  signed_at: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho:  { label: "Rascunho",              cls: "bg-[#243A66]/40 text-[#7A8FA8] border-[#243A66]" },
  enviado:   { label: "Aguardando assinatura", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  assinado:  { label: "Assinado",              cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado",             cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const INPUT = "w-full px-3 py-2 rounded-lg border border-[#243A66] bg-[#09081A] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C] transition-colors";

export function EnviarContratoParceria({
  registrationId,
  plano,
  cadastro,
}: {
  registrationId: string;
  plano: PlanoContratoParceria;
  cadastro: CadastroParaContrato;
}) {
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [template, setTemplate] = useState<ParceriaTemplate | null | undefined>(undefined);
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosLicenciado>(() => dadosDoCadastro(cadastro));
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function carregarContratos() {
    fetch(`/api/cadastro-partner/contrato?registration_id=${registrationId}`)
      .then((r) => r.json())
      .then((j) => setContratos(j.contratos ?? []))
      .catch(() => setContratos([]));
  }

  useEffect(() => {
    carregarContratos();
    fetch("/api/contracts/templates?vertical=clientes")
      .then((r) => r.json())
      .then((j) => setTemplate(pickContratoParceriaTemplate((j.templates ?? []) as ParceriaTemplate[])))
      .catch(() => setTemplate(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationId]);

  const faltam = camposFaltantes(dados);
  const faltamKeys = new Set(faltam.map((c) => c.key));
  const templateAprovado = template?.approval_status === "aprovado";
  const ativo = (contratos ?? []).find((c) => c.status_signature === "enviado" || c.status_signature === "assinado");

  async function gerarEEnviar() {
    setTentou(true);
    if (!template || faltam.length > 0) return;
    setEnviando(true);
    setErro(null);
    setOk(null);
    try {
      // O e-mail não vai: o servidor usa sempre o do cadastro.
      const ajustes: Partial<DadosLicenciado> = { ...dados };
      delete ajustes.email;
      const gen = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          partner_registration_id: registrationId,
          extra_data: { parceria: ajustes },
        }),
      }).then((r) => r.json());
      if (gen.error || !gen.contract) {
        setErro(gen.error ?? "Erro ao gerar o contrato.");
        return;
      }
      const code: string = gen.contract.contract_code ?? "";
      const send = await fetch(`/api/contracts/${gen.contract.id}/send`, { method: "POST" }).then((r) => r.json());
      if (send.error) {
        setErro(`Contrato ${code} gerado, mas o envio para assinatura falhou: ${send.error}. Ele ficou como rascunho na Central de Contratos.`);
      } else {
        setOk(`Contrato ${code} enviado para assinatura em ${dados.email}. Ele já aparece na Central de Contratos.`);
        setAberto(false);
      }
      carregarContratos();
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="p-4 rounded-xl bg-[#0D1929] border border-[#243A66] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileSignature className="w-4 h-4 text-[#C9A84C] mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">Contrato de Parceria v2.2</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Licenciamento {PLANO_LABEL[plano]}. Sai com os dados do cadastro, vai para assinatura no ClickSign e fica na Central de Contratos.
            </p>
          </div>
        </div>
        {!aberto && (
          <button
            onClick={() => { setAberto(true); setErro(null); setOk(null); setTentou(false); }}
            disabled={template === undefined || !templateAprovado}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold disabled:opacity-50 transition-colors"
          >
            {template === undefined ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {ativo ? "Enviar de novo" : "Enviar contrato"}
          </button>
        )}
      </div>

      {template === null && (
        <p className="text-[11px] text-amber-400">Minuta do Contrato de Parceria v2.2 não encontrada (ou inativa) na Central de Contratos.</p>
      )}
      {template && !templateAprovado && (
        <p className="text-[11px] text-amber-400">A minuta ainda não está aprovada em Central de Contratos › Minutas (status: {template.approval_status}).</p>
      )}

      {/* Contratos já gerados */}
      {contratos && contratos.length > 0 && (
        <div className="space-y-1.5">
          {contratos.map((c) => {
            const st = STATUS[c.status_signature] ?? { label: c.status_signature, cls: "bg-[#243A66]/40 text-[#7A8FA8] border-[#243A66]" };
            const quando = c.signed_at ?? c.sent_to_signature_at ?? c.created_at;
            return (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-foreground">{c.contract_code ?? "sem código"}</span>
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border", st.cls)}>{st.label}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(quando).toLocaleDateString("pt-BR")}</span>
              </div>
            );
          })}
          <Link href="/juridico/contratos" className="inline-flex items-center gap-1 text-[10px] text-[#C9A84C] hover:text-[#E8C97A]">
            <ExternalLink className="w-3 h-3" /> Abrir Central de Contratos
          </Link>
        </div>
      )}

      {ok && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-900/20 border border-emerald-700/40 text-emerald-400 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {ok}
        </div>
      )}
      {erro && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-700/40 text-red-400 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {erro}
        </div>
      )}

      {/* Formulário: confere/completa os dados do licenciado */}
      {aberto && (
        <div className="space-y-3 pt-1">
          {ativo && (
            <p className="text-[11px] text-amber-400">
              Este cadastro já tem o contrato {ativo.contract_code} ({STATUS[ativo.status_signature]?.label.toLowerCase()}). Enviar de novo gera um contrato novo.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">Confira os dados do LICENCIADO. O que veio do cadastro já está preenchido; complete o que faltar.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CAMPOS_LICENCIADO.map((c) => (
              <label key={c.key} className={cn("block space-y-1", (c.key === "endereco" || c.key === "modulos") && "sm:col-span-2")}>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <input
                  value={dados[c.key]}
                  onChange={(e) => setDados((d) => ({ ...d, [c.key]: e.target.value }))}
                  disabled={c.key === "email"}
                  placeholder={c.placeholder}
                  className={cn(INPUT, c.key === "email" && "opacity-60", tentou && faltamKeys.has(c.key) && "border-red-500/60")}
                />
              </label>
            ))}
          </div>
          {tentou && faltam.length > 0 && (
            <p className="text-[10px] text-red-400">Preencha: {faltam.map((c) => c.label).join(", ")}.</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={gerarEEnviar}
              disabled={enviando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold disabled:opacity-50 transition-colors"
            >
              {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Gerar e enviar para assinatura
            </button>
            <button
              onClick={() => setAberto(false)}
              disabled={enviando}
              className="px-3 py-2.5 rounded-lg border border-[#243A66] text-muted-foreground hover:text-foreground text-xs disabled:opacity-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
